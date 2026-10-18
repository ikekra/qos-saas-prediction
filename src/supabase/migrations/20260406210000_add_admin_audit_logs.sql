-- Admin action audit table for RBAC-protected operations

CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  actor_email TEXT,
  action TEXT NOT NULL,
  resource TEXT NOT NULL DEFAULT 'token_balance',
  target_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  target_email TEXT,
  status TEXT NOT NULL CHECK (status IN ('attempt', 'success', 'failed', 'denied')),
  request_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  before_value NUMERIC,
  after_value NUMERIC,
  delta_value NUMERIC,
  reason TEXT,
  confirm_phrase TEXT,
  bulk_count INTEGER NOT NULL DEFAULT 1 CHECK (bulk_count > 0),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at
  ON public.admin_audit_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_actor
  ON public.admin_audit_logs(actor_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_target
  ON public.admin_audit_logs(target_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_action_status
  ON public.admin_audit_logs(action, status, created_at DESC);

ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_audit_logs_admin_select ON public.admin_audit_logs;
CREATE POLICY admin_audit_logs_admin_select
  ON public.admin_audit_logs FOR SELECT
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

DROP POLICY IF EXISTS admin_audit_logs_admin_insert ON public.admin_audit_logs;
CREATE POLICY admin_audit_logs_admin_insert
  ON public.admin_audit_logs FOR INSERT
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

GRANT SELECT, INSERT ON TABLE public.admin_audit_logs TO authenticated;
