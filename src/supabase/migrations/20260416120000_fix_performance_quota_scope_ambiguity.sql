-- Fix ambiguous column references in performance quota RPCs.
-- Some PostgREST/PLpgSQL paths resolve `scope_type` ambiguously because the
-- function output columns and table columns share the same names. This replaces
-- the functions with fully qualified statements and explicit return aliases.

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
#variable_conflict use_column
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

  SELECT prc.*
  INTO cycle_row
  FROM public.performance_run_cycles AS prc
  WHERE prc.scope_type = p_scope_type
    AND prc.scope_id = p_scope_id
  FOR UPDATE;

  IF cycle_row.reset_date < CURRENT_DATE THEN
    UPDATE public.performance_run_cycles AS prc
    SET
      plan = p_plan,
      run_limit = p_run_limit,
      runs_used = 0,
      reset_date = p_reset_date,
      account_manager_webhook = p_account_manager_webhook,
      soft_limit_alerted_at = NULL,
      hard_limit_alerted_at = NULL
    WHERE prc.id = cycle_row.id
    RETURNING * INTO cycle_row;
  ELSIF cycle_row.plan IS DISTINCT FROM p_plan
    OR cycle_row.run_limit IS DISTINCT FROM p_run_limit
    OR cycle_row.reset_date IS DISTINCT FROM p_reset_date
    OR cycle_row.account_manager_webhook IS DISTINCT FROM p_account_manager_webhook THEN
    UPDATE public.performance_run_cycles AS prc
    SET
      plan = p_plan,
      run_limit = p_run_limit,
      reset_date = p_reset_date,
      account_manager_webhook = p_account_manager_webhook
    WHERE prc.id = cycle_row.id
    RETURNING * INTO cycle_row;
  END IF;

  soft_threshold := CEIL(p_run_limit * 0.9);

  IF cycle_row.runs_used >= p_run_limit THEN
    RETURN QUERY
    SELECT
      FALSE AS success,
      TRUE AS blocked,
      cycle_row.plan AS plan,
      cycle_row.scope_type AS scope_type,
      cycle_row.scope_id AS scope_id,
      cycle_row.run_limit AS run_limit,
      cycle_row.runs_used AS runs_used,
      GREATEST(cycle_row.run_limit - cycle_row.runs_used, 0) AS runs_remaining,
      cycle_row.runs_used AS run_number,
      cycle_row.reset_date AS reset_date,
      cycle_row.soft_limit_alerted_at AS soft_limit_alerted_at,
      cycle_row.hard_limit_alerted_at AS hard_limit_alerted_at,
      FALSE AS soft_alert_needed,
      (cycle_row.plan = 'enterprise' AND cycle_row.hard_limit_alerted_at IS NULL) AS hard_alert_needed;
    RETURN;
  END IF;

  next_runs_used := cycle_row.runs_used + 1;

  UPDATE public.performance_run_cycles AS prc
  SET runs_used = next_runs_used
  WHERE prc.id = cycle_row.id
  RETURNING * INTO cycle_row;

  RETURN QUERY
  SELECT
    TRUE AS success,
    FALSE AS blocked,
    cycle_row.plan AS plan,
    cycle_row.scope_type AS scope_type,
    cycle_row.scope_id AS scope_id,
    cycle_row.run_limit AS run_limit,
    cycle_row.runs_used AS runs_used,
    GREATEST(cycle_row.run_limit - cycle_row.runs_used, 0) AS runs_remaining,
    cycle_row.runs_used AS run_number,
    cycle_row.reset_date AS reset_date,
    cycle_row.soft_limit_alerted_at AS soft_limit_alerted_at,
    cycle_row.hard_limit_alerted_at AS hard_limit_alerted_at,
    (cycle_row.plan = 'enterprise'
      AND cycle_row.runs_used >= soft_threshold
      AND cycle_row.soft_limit_alerted_at IS NULL) AS soft_alert_needed,
    FALSE AS hard_alert_needed;
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
    UPDATE public.performance_run_cycles AS prc
    SET soft_limit_alerted_at = COALESCE(prc.soft_limit_alerted_at, now())
    WHERE prc.scope_type = p_scope_type
      AND prc.scope_id = p_scope_id;
  ELSIF p_alert_type = 'hard' THEN
    UPDATE public.performance_run_cycles AS prc
    SET hard_limit_alerted_at = COALESCE(prc.hard_limit_alerted_at, now())
    WHERE prc.scope_type = p_scope_type
      AND prc.scope_id = p_scope_id;
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
  UPDATE public.performance_run_cycles AS prc
  SET runs_used = GREATEST(prc.runs_used - 1, 0)
  WHERE prc.scope_type = p_scope_type
    AND prc.scope_id = p_scope_id;
END;
$$;
