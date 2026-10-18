-- Ensure users can read their own billing and token usage data.
-- Safe to run multiple times.

ALTER TABLE IF EXISTS public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.token_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.payments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'user_profiles'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'user_profiles'
        AND policyname = 'user_profiles_select_own'
    ) THEN
      EXECUTE 'CREATE POLICY user_profiles_select_own ON public.user_profiles FOR SELECT USING (auth.uid() = id)';
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'token_transactions'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'token_transactions'
        AND policyname = 'token_transactions_select_own'
    ) THEN
      EXECUTE 'CREATE POLICY token_transactions_select_own ON public.token_transactions FOR SELECT USING (auth.uid() = user_id)';
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'payments'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'payments'
        AND policyname = 'payments_select_own'
    ) THEN
      EXECUTE 'CREATE POLICY payments_select_own ON public.payments FOR SELECT USING (auth.uid() = user_id)';
    END IF;
  END IF;
END $$;

GRANT SELECT ON TABLE public.user_profiles TO authenticated;
GRANT SELECT ON TABLE public.token_transactions TO authenticated;
GRANT SELECT ON TABLE public.payments TO authenticated;

