-- QOSCollab: add QoS predictions and optional service comparison fields

-- 1) Main table: qos_predictions
CREATE TABLE IF NOT EXISTS public.qos_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  latency DOUBLE PRECISION NOT NULL CHECK (latency >= 0),
  throughput DOUBLE PRECISION NOT NULL CHECK (throughput >= 0),
  availability DOUBLE PRECISION NOT NULL CHECK (availability BETWEEN 0 AND 100),
  reliability DOUBLE PRECISION NOT NULL CHECK (reliability BETWEEN 0 AND 100),
  response_time DOUBLE PRECISION NOT NULL CHECK (response_time >= 0),
  predicted_efficiency DOUBLE PRECISION NOT NULL CHECK (predicted_efficiency BETWEEN 0 AND 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2) Optional comparison support on existing services table
-- services already exists in this project, so we extend it safely.
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS latency DOUBLE PRECISION CHECK (latency >= 0),
  ADD COLUMN IF NOT EXISTS throughput DOUBLE PRECISION CHECK (throughput >= 0),
  ADD COLUMN IF NOT EXISTS availability DOUBLE PRECISION CHECK (availability BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS reliability DOUBLE PRECISION CHECK (reliability BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS response_time DOUBLE PRECISION CHECK (response_time >= 0);

-- Backfill user_id from existing created_by for compatibility
UPDATE public.services
SET user_id = created_by
WHERE user_id IS NULL
  AND created_by IS NOT NULL;

-- Add FK on services.user_id if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'services_user_id_fkey'
      AND conrelid = 'public.services'::regclass
  ) THEN
    ALTER TABLE public.services
      ADD CONSTRAINT services_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END
$$;

-- 3) Index optimization
CREATE INDEX IF NOT EXISTS idx_qos_predictions_user_created_at
  ON public.qos_predictions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_qos_predictions_created_at
  ON public.qos_predictions (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_services_user_created_at
  ON public.services (user_id, created_at DESC);

-- 4) RLS setup
ALTER TABLE public.qos_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

-- qos_predictions owner-only policies
DROP POLICY IF EXISTS "qos_predictions_owner_select" ON public.qos_predictions;
DROP POLICY IF EXISTS "qos_predictions_owner_insert" ON public.qos_predictions;
DROP POLICY IF EXISTS "qos_predictions_owner_update" ON public.qos_predictions;
DROP POLICY IF EXISTS "qos_predictions_owner_delete" ON public.qos_predictions;

CREATE POLICY "qos_predictions_owner_select"
  ON public.qos_predictions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "qos_predictions_owner_insert"
  ON public.qos_predictions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "qos_predictions_owner_update"
  ON public.qos_predictions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "qos_predictions_owner_delete"
  ON public.qos_predictions FOR DELETE
  USING (auth.uid() = user_id);

-- services policies aligned to user_id when present, or fallback to created_by for old rows.
-- Keep existing public SELECT policy intact if already defined by earlier migrations.
DROP POLICY IF EXISTS "Authenticated users can create services" ON public.services;
DROP POLICY IF EXISTS "Users can update their own services" ON public.services;
DROP POLICY IF EXISTS "Users can delete their own services" ON public.services;

CREATE POLICY "Authenticated users can create services"
  ON public.services FOR INSERT
  WITH CHECK (
    auth.uid() = COALESCE(user_id, created_by)
  );

CREATE POLICY "Users can update their own services"
  ON public.services FOR UPDATE
  USING (
    auth.uid() = COALESCE(user_id, created_by)
  )
  WITH CHECK (
    auth.uid() = COALESCE(user_id, created_by)
  );

CREATE POLICY "Users can delete their own services"
  ON public.services FOR DELETE
  USING (
    auth.uid() = COALESCE(user_id, created_by)
  );

-- 5) Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qos_predictions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.services TO authenticated;
