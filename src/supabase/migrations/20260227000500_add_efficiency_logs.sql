-- Add efficiency_logs table for ML prediction request auditing

CREATE TABLE IF NOT EXISTS public.efficiency_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  prediction_response JSONB,
  status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'error')),
  status_code INTEGER NOT NULL,
  error_message TEXT,
  latency_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_efficiency_logs_user_created_at
  ON public.efficiency_logs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_efficiency_logs_status_code
  ON public.efficiency_logs (status_code);

ALTER TABLE public.efficiency_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "efficiency_logs_owner_select" ON public.efficiency_logs;
DROP POLICY IF EXISTS "efficiency_logs_owner_insert" ON public.efficiency_logs;

CREATE POLICY "efficiency_logs_owner_select"
  ON public.efficiency_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "efficiency_logs_owner_insert"
  ON public.efficiency_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT ON public.efficiency_logs TO authenticated;
