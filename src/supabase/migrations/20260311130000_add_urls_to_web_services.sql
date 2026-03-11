-- Add URL fields to web_services for live testing
ALTER TABLE public.web_services
  ADD COLUMN IF NOT EXISTS base_url TEXT,
  ADD COLUMN IF NOT EXISTS docs_url TEXT;

CREATE INDEX IF NOT EXISTS idx_web_services_base_url ON public.web_services(base_url);
