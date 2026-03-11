-- Create web_services directory table
CREATE TABLE IF NOT EXISTS public.web_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  logo_url TEXT,
  provider TEXT NOT NULL,
  description TEXT NOT NULL,
  base_latency_estimate NUMERIC CHECK (base_latency_estimate >= 0),
  availability_score NUMERIC CHECK (availability_score BETWEEN 0 AND 100),
  is_active BOOLEAN NOT NULL DEFAULT true,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (name, provider)
);

-- Indexes for search/filter
CREATE INDEX IF NOT EXISTS idx_web_services_category ON public.web_services(category);
CREATE INDEX IF NOT EXISTS idx_web_services_provider ON public.web_services(provider);
CREATE INDEX IF NOT EXISTS idx_web_services_active ON public.web_services(is_active);
CREATE INDEX IF NOT EXISTS idx_web_services_created_at ON public.web_services(created_at DESC);

-- Optional full-text search index (name + provider + description)
CREATE INDEX IF NOT EXISTS idx_web_services_search
  ON public.web_services
  USING GIN (to_tsvector('english', name || ' ' || provider || ' ' || description));

-- Updated_at trigger
CREATE TRIGGER update_web_services_updated_at
  BEFORE UPDATE ON public.web_services
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS (directory is public read, admin write via service role)
ALTER TABLE public.web_services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "web_services_public_read" ON public.web_services;
CREATE POLICY "web_services_public_read"
  ON public.web_services FOR SELECT
  USING (is_active = true);

GRANT SELECT ON public.web_services TO authenticated, anon;
