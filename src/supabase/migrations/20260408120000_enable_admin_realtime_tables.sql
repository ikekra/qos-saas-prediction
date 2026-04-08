-- Enable realtime streaming for admin-facing tables.
-- Safe to run repeatedly.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'web_services'
  ) THEN
    BEGIN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.web_services';
    EXCEPTION
      WHEN duplicate_object THEN NULL;
      WHEN undefined_object THEN NULL;
    END;
    EXECUTE 'ALTER TABLE public.web_services REPLICA IDENTITY FULL';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'admin_audit_logs'
  ) THEN
    BEGIN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_audit_logs';
    EXCEPTION
      WHEN duplicate_object THEN NULL;
      WHEN undefined_object THEN NULL;
    END;
    EXECUTE 'ALTER TABLE public.admin_audit_logs REPLICA IDENTITY FULL';
  END IF;
END $$;
