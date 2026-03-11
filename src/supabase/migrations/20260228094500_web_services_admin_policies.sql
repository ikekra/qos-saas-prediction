-- Admin write policies for web_services using role claim

ALTER TABLE public.web_services ENABLE ROW LEVEL SECURITY;

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
