-- Backend structure: web_services, qos_predictions policies, service_recommendations, model_feedback

-- 1) web_services table (ensure required columns exist)
CREATE TABLE IF NOT EXISTS public.web_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  service_name TEXT,
  provider TEXT NOT NULL,
  category TEXT NOT NULL,
  logo_url TEXT,
  description TEXT NOT NULL,
  avg_latency NUMERIC CHECK (avg_latency >= 0),
  availability_score NUMERIC CHECK (availability_score BETWEEN 0 AND 100),
  reliability_score NUMERIC CHECK (reliability_score BETWEEN 0 AND 100),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Backfill compatibility columns if table existed
UPDATE public.web_services
SET
  service_name = COALESCE(service_name, name),
  name = COALESCE(name, service_name),
  avg_latency = COALESCE(avg_latency, (SELECT base_latency_estimate FROM public.web_services ws2 WHERE ws2.id = web_services.id)),
  reliability_score = COALESCE(reliability_score, availability_score)
WHERE service_name IS NULL OR name IS NULL OR avg_latency IS NULL OR reliability_score IS NULL;

-- Indexes for web_services
CREATE INDEX IF NOT EXISTS idx_web_services_service_name ON public.web_services(service_name);
CREATE INDEX IF NOT EXISTS idx_web_services_provider ON public.web_services(provider);
CREATE INDEX IF NOT EXISTS idx_web_services_category ON public.web_services(category);
CREATE INDEX IF NOT EXISTS idx_web_services_active ON public.web_services(is_active);

-- Updated_at trigger (reuse existing function)
DROP TRIGGER IF EXISTS update_web_services_updated_at ON public.web_services;
CREATE TRIGGER update_web_services_updated_at
  BEFORE UPDATE ON public.web_services
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS for web_services
ALTER TABLE public.web_services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "web_services_public_read" ON public.web_services;
CREATE POLICY "web_services_public_read"
  ON public.web_services FOR SELECT
  USING (is_active = true);

-- Admin role claim policies
DROP POLICY IF EXISTS "web_services_admin_insert" ON public.web_services;
DROP POLICY IF EXISTS "web_services_admin_update" ON public.web_services;
DROP POLICY IF EXISTS "web_services_admin_delete" ON public.web_services;

CREATE POLICY "web_services_admin_insert"
  ON public.web_services FOR INSERT
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "web_services_admin_update"
  ON public.web_services FOR UPDATE
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "web_services_admin_delete"
  ON public.web_services FOR DELETE
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

GRANT SELECT ON public.web_services TO authenticated, anon;

-- 2) qos_predictions policies + FK
ALTER TABLE public.qos_predictions
  ADD COLUMN IF NOT EXISTS service_id UUID REFERENCES public.web_services(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_qos_predictions_service_id
  ON public.qos_predictions(service_id);

-- Allow inserts without explicitly sending user_id (trigger will set it)
DROP POLICY IF EXISTS "qos_predictions_owner_insert" ON public.qos_predictions;
CREATE POLICY "qos_predictions_owner_insert"
  ON public.qos_predictions FOR INSERT
  WITH CHECK (auth.uid() = COALESCE(user_id, auth.uid()));

-- 3) service_recommendations table
CREATE TABLE IF NOT EXISTS public.service_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.web_services(id) ON DELETE CASCADE,
  score NUMERIC CHECK (score >= 0),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_service_recommendations_user_id
  ON public.service_recommendations(user_id);
CREATE INDEX IF NOT EXISTS idx_service_recommendations_service_id
  ON public.service_recommendations(service_id);

ALTER TABLE public.service_recommendations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_recommendations_owner_select" ON public.service_recommendations;
DROP POLICY IF EXISTS "service_recommendations_owner_insert" ON public.service_recommendations;

CREATE POLICY "service_recommendations_owner_select"
  ON public.service_recommendations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "service_recommendations_owner_insert"
  ON public.service_recommendations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT ON public.service_recommendations TO authenticated;

-- 4) model_feedback table
CREATE TABLE IF NOT EXISTS public.model_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prediction_id UUID NOT NULL REFERENCES public.qos_predictions(id) ON DELETE CASCADE,
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_model_feedback_user_id
  ON public.model_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_model_feedback_prediction_id
  ON public.model_feedback(prediction_id);

ALTER TABLE public.model_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "model_feedback_owner_select" ON public.model_feedback;
DROP POLICY IF EXISTS "model_feedback_owner_insert" ON public.model_feedback;

CREATE POLICY "model_feedback_owner_select"
  ON public.model_feedback FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "model_feedback_owner_insert"
  ON public.model_feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT ON public.model_feedback TO authenticated;

-- 5) Storage bucket for service logos (public read)
INSERT INTO storage.buckets (id, name, public)
VALUES ('service-logos', 'service-logos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "service_logos_public_read" ON storage.objects;
CREATE POLICY "service_logos_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'service-logos');

-- Optional admin write access
DROP POLICY IF EXISTS "service_logos_admin_write" ON storage.objects;
CREATE POLICY "service_logos_admin_write"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'service-logos' AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

DROP POLICY IF EXISTS "service_logos_admin_update" ON storage.objects;
CREATE POLICY "service_logos_admin_update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'service-logos' AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

DROP POLICY IF EXISTS "service_logos_admin_delete" ON storage.objects;
CREATE POLICY "service_logos_admin_delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'service-logos' AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
