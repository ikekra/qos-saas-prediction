-- Marketing lead capture for newsletter and demo requests

CREATE TABLE IF NOT EXISTS public.marketing_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  lead_type TEXT NOT NULL CHECK (lead_type IN ('newsletter', 'demo_request')),
  name TEXT,
  company TEXT,
  message TEXT,
  source TEXT NOT NULL DEFAULT 'landing_page',
  status TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS marketing_leads_email_lead_type_key
  ON public.marketing_leads (email, lead_type);

ALTER TABLE public.marketing_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "marketing_leads_insert_public" ON public.marketing_leads;
CREATE POLICY "marketing_leads_insert_public"
  ON public.marketing_leads
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "marketing_leads_select_admin" ON public.marketing_leads;
CREATE POLICY "marketing_leads_select_admin"
  ON public.marketing_leads
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'admin'
    )
  );

GRANT INSERT ON public.marketing_leads TO anon, authenticated;
GRANT SELECT, UPDATE ON public.marketing_leads TO authenticated;

DROP TRIGGER IF EXISTS update_marketing_leads_updated_at ON public.marketing_leads;
CREATE TRIGGER update_marketing_leads_updated_at
  BEFORE UPDATE ON public.marketing_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
