-- Allow public/authenticated users to read web_services
ALTER TABLE public.web_services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "web_services_public_select" ON public.web_services;
CREATE POLICY "web_services_public_select"
  ON public.web_services FOR SELECT
  USING (true);

GRANT SELECT ON public.web_services TO anon, authenticated;
