ALTER TABLE IF EXISTS public.user_profiles
  ADD COLUMN IF NOT EXISTS performance_plan TEXT DEFAULT 'standard'
    CHECK (performance_plan IN ('standard', 'pro', 'enterprise')),
  ADD COLUMN IF NOT EXISTS performance_run_limit INTEGER,
  ADD COLUMN IF NOT EXISTS performance_cycle_reset_at DATE,
  ADD COLUMN IF NOT EXISTS performance_org_id TEXT,
  ADD COLUMN IF NOT EXISTS account_manager_webhook TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_profiles'
      AND column_name = 'organization'
  ) THEN
    EXECUTE $sql$
      UPDATE public.user_profiles
      SET performance_org_id = COALESCE(NULLIF(performance_org_id, ''), NULLIF(organization, ''))
      WHERE COALESCE(NULLIF(performance_org_id, ''), NULLIF(organization, '')) IS NOT NULL
    $sql$;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.performance_run_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_type TEXT NOT NULL CHECK (scope_type IN ('user', 'org')),
  scope_id TEXT NOT NULL,
  plan TEXT NOT NULL CHECK (plan IN ('standard', 'pro', 'enterprise')),
  run_limit INTEGER NOT NULL CHECK (run_limit > 0),
  runs_used INTEGER NOT NULL DEFAULT 0 CHECK (runs_used >= 0),
  reset_date DATE NOT NULL,
  account_manager_webhook TEXT,
  soft_limit_alerted_at TIMESTAMPTZ,
  hard_limit_alerted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (scope_type, scope_id)
);

CREATE TABLE IF NOT EXISTS public.performance_test_run_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT,
  user_id UUID NOT NULL,
  plan TEXT NOT NULL CHECK (plan IN ('standard', 'pro', 'enterprise')),
  run_number INTEGER NOT NULL CHECK (run_number > 0),
  test_type TEXT NOT NULL,
  duration_ms INTEGER,
  result_summary TEXT,
  quota_scope_type TEXT NOT NULL CHECK (quota_scope_type IN ('user', 'org')),
  quota_scope_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.performance_run_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_test_run_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'update_updated_at_column'
      AND pg_function_is_visible(oid)
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'update_performance_run_cycles_updated_at'
  ) THEN
    CREATE TRIGGER update_performance_run_cycles_updated_at
      BEFORE UPDATE ON public.performance_run_cycles
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_performance_run_cycles_scope
  ON public.performance_run_cycles (scope_type, scope_id);

CREATE INDEX IF NOT EXISTS idx_performance_test_run_logs_user_created
  ON public.performance_test_run_logs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_performance_test_run_logs_org_created
  ON public.performance_test_run_logs (org_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.reserve_performance_test_run(
  p_scope_type TEXT,
  p_scope_id TEXT,
  p_plan TEXT,
  p_run_limit INTEGER,
  p_reset_date DATE,
  p_account_manager_webhook TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  blocked BOOLEAN,
  plan TEXT,
  scope_type TEXT,
  scope_id TEXT,
  run_limit INTEGER,
  runs_used INTEGER,
  runs_remaining INTEGER,
  run_number INTEGER,
  reset_date DATE,
  soft_limit_alerted_at TIMESTAMPTZ,
  hard_limit_alerted_at TIMESTAMPTZ,
  soft_alert_needed BOOLEAN,
  hard_alert_needed BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  cycle_row public.performance_run_cycles%ROWTYPE;
  next_runs_used INTEGER;
  soft_threshold INTEGER;
BEGIN
  IF p_scope_type NOT IN ('user', 'org') THEN
    RAISE EXCEPTION 'Invalid scope_type: %', p_scope_type;
  END IF;

  IF p_plan NOT IN ('standard', 'pro', 'enterprise') THEN
    RAISE EXCEPTION 'Invalid plan: %', p_plan;
  END IF;

  IF p_run_limit IS NULL OR p_run_limit <= 0 THEN
    RAISE EXCEPTION 'Invalid run_limit: %', p_run_limit;
  END IF;

  IF p_scope_id IS NULL OR btrim(p_scope_id) = '' THEN
    RAISE EXCEPTION 'scope_id is required';
  END IF;

  INSERT INTO public.performance_run_cycles (
    scope_type,
    scope_id,
    plan,
    run_limit,
    runs_used,
    reset_date,
    account_manager_webhook
  )
  VALUES (
    p_scope_type,
    p_scope_id,
    p_plan,
    p_run_limit,
    0,
    p_reset_date,
    p_account_manager_webhook
  )
  ON CONFLICT (scope_type, scope_id) DO NOTHING;

  SELECT *
  INTO cycle_row
  FROM public.performance_run_cycles
  WHERE performance_run_cycles.scope_type = p_scope_type
    AND performance_run_cycles.scope_id = p_scope_id
  FOR UPDATE;

  IF cycle_row.reset_date < CURRENT_DATE THEN
    UPDATE public.performance_run_cycles
    SET
      plan = p_plan,
      run_limit = p_run_limit,
      runs_used = 0,
      reset_date = p_reset_date,
      account_manager_webhook = p_account_manager_webhook,
      soft_limit_alerted_at = NULL,
      hard_limit_alerted_at = NULL
    WHERE id = cycle_row.id
    RETURNING * INTO cycle_row;
  ELSIF cycle_row.plan IS DISTINCT FROM p_plan
    OR cycle_row.run_limit IS DISTINCT FROM p_run_limit
    OR cycle_row.reset_date IS DISTINCT FROM p_reset_date
    OR cycle_row.account_manager_webhook IS DISTINCT FROM p_account_manager_webhook THEN
    UPDATE public.performance_run_cycles
    SET
      plan = p_plan,
      run_limit = p_run_limit,
      reset_date = p_reset_date,
      account_manager_webhook = p_account_manager_webhook
    WHERE id = cycle_row.id
    RETURNING * INTO cycle_row;
  END IF;

  soft_threshold := CEIL(p_run_limit * 0.9);

  IF cycle_row.runs_used >= p_run_limit THEN
    RETURN QUERY
    SELECT
      FALSE,
      TRUE,
      cycle_row.plan,
      cycle_row.scope_type,
      cycle_row.scope_id,
      cycle_row.run_limit,
      cycle_row.runs_used,
      GREATEST(cycle_row.run_limit - cycle_row.runs_used, 0),
      cycle_row.runs_used,
      cycle_row.reset_date,
      cycle_row.soft_limit_alerted_at,
      cycle_row.hard_limit_alerted_at,
      FALSE,
      cycle_row.plan = 'enterprise' AND cycle_row.hard_limit_alerted_at IS NULL;
    RETURN;
  END IF;

  next_runs_used := cycle_row.runs_used + 1;

  UPDATE public.performance_run_cycles
  SET runs_used = next_runs_used
  WHERE id = cycle_row.id
  RETURNING * INTO cycle_row;

  RETURN QUERY
  SELECT
    TRUE,
    FALSE,
    cycle_row.plan,
    cycle_row.scope_type,
    cycle_row.scope_id,
    cycle_row.run_limit,
    cycle_row.runs_used,
    GREATEST(cycle_row.run_limit - cycle_row.runs_used, 0),
    cycle_row.runs_used,
    cycle_row.reset_date,
    cycle_row.soft_limit_alerted_at,
    cycle_row.hard_limit_alerted_at,
    cycle_row.plan = 'enterprise'
      AND cycle_row.runs_used >= soft_threshold
      AND cycle_row.soft_limit_alerted_at IS NULL,
    FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.acknowledge_performance_quota_alert(
  p_scope_type TEXT,
  p_scope_id TEXT,
  p_alert_type TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_alert_type = 'soft' THEN
    UPDATE public.performance_run_cycles
    SET soft_limit_alerted_at = COALESCE(soft_limit_alerted_at, now())
    WHERE scope_type = p_scope_type
      AND scope_id = p_scope_id;
  ELSIF p_alert_type = 'hard' THEN
    UPDATE public.performance_run_cycles
    SET hard_limit_alerted_at = COALESCE(hard_limit_alerted_at, now())
    WHERE scope_type = p_scope_type
      AND scope_id = p_scope_id;
  ELSE
    RAISE EXCEPTION 'Unsupported alert type: %', p_alert_type;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_performance_test_run(
  p_scope_type TEXT,
  p_scope_id TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.performance_run_cycles
  SET runs_used = GREATEST(runs_used - 1, 0)
  WHERE scope_type = p_scope_type
    AND scope_id = p_scope_id;
END;
$$;
