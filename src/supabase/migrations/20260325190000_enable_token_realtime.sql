-- Ensure token-related tables stream realtime changes to clients.
-- Safe to run multiple times.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'user_profiles'
  ) THEN
    BEGIN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.user_profiles';
    EXCEPTION
      WHEN duplicate_object THEN NULL;
      WHEN undefined_object THEN NULL;
    END;
    EXECUTE 'ALTER TABLE public.user_profiles REPLICA IDENTITY FULL';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'token_transactions'
  ) THEN
    BEGIN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.token_transactions';
    EXCEPTION
      WHEN duplicate_object THEN NULL;
      WHEN undefined_object THEN NULL;
    END;
    EXECUTE 'ALTER TABLE public.token_transactions REPLICA IDENTITY FULL';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'payments'
  ) THEN
    BEGIN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.payments';
    EXCEPTION
      WHEN duplicate_object THEN NULL;
      WHEN undefined_object THEN NULL;
    END;
    EXECUTE 'ALTER TABLE public.payments REPLICA IDENTITY FULL';
  END IF;
END $$;

