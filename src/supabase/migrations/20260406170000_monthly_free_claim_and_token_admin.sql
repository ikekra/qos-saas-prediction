-- Monthly free-token claim + token admin summary helpers

CREATE TABLE IF NOT EXISTS public.monthly_token_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  claim_month DATE NOT NULL,
  tokens_granted INTEGER NOT NULL CHECK (tokens_granted > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, claim_month)
);

CREATE INDEX IF NOT EXISTS idx_monthly_token_claims_user_month
  ON public.monthly_token_claims(user_id, claim_month DESC);

ALTER TABLE public.monthly_token_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS monthly_token_claims_owner_select ON public.monthly_token_claims;
CREATE POLICY monthly_token_claims_owner_select
  ON public.monthly_token_claims FOR SELECT
  USING (auth.uid() = user_id);

DROP FUNCTION IF EXISTS public.claim_free_monthly_tokens(INTEGER);
CREATE OR REPLACE FUNCTION public.claim_free_monthly_tokens(
  p_tokens INTEGER DEFAULT 500
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_month DATE := date_trunc('month', now())::date;
  v_next_month DATE := (date_trunc('month', now()) + INTERVAL '1 month')::date;
  v_claim_id UUID;
  v_balance NUMERIC := 0;
  v_email TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  IF p_tokens IS NULL OR p_tokens <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_token_amount');
  END IF;

  INSERT INTO public.monthly_token_claims (user_id, claim_month, tokens_granted)
  VALUES (v_user_id, v_month, p_tokens)
  ON CONFLICT (user_id, claim_month) DO NOTHING
  RETURNING id INTO v_claim_id;

  IF v_claim_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'already_claimed',
      'next_eligible_at', v_next_month::text
    );
  END IF;

  SELECT email INTO v_email
  FROM auth.users
  WHERE id = v_user_id;

  INSERT INTO public.user_profiles (id, email, token_balance, lifetime_tokens_used)
  VALUES (v_user_id, COALESCE(v_email, v_user_id::text || '@local.user'), 0, 0)
  ON CONFLICT (id) DO NOTHING;

  UPDATE public.user_profiles
  SET token_balance = COALESCE(token_balance, 0) + p_tokens
  WHERE id = v_user_id
  RETURNING token_balance INTO v_balance;

  INSERT INTO public.token_transactions (
    user_id,
    type,
    amount,
    balance_after,
    description,
    endpoint
  )
  VALUES (
    v_user_id,
    'credit',
    p_tokens,
    v_balance,
    'Monthly free token grant',
    '/functions/v1/claim-free-monthly'
  );

  RETURN jsonb_build_object(
    'success', true,
    'claimed_month', v_month::text,
    'tokens_granted', p_tokens,
    'new_balance', v_balance
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_free_monthly_tokens(INTEGER) TO authenticated;

DROP FUNCTION IF EXISTS public.get_token_admin_summary();
CREATE OR REPLACE FUNCTION public.get_token_admin_summary()
RETURNS TABLE (
  total_users BIGINT,
  total_token_balance NUMERIC,
  total_lifetime_tokens_used NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COUNT(*)::BIGINT AS total_users,
    COALESCE(SUM(COALESCE(token_balance, 0)), 0)::NUMERIC AS total_token_balance,
    COALESCE(SUM(COALESCE(lifetime_tokens_used, 0)), 0)::NUMERIC AS total_lifetime_tokens_used
  FROM public.user_profiles;
$$;

GRANT EXECUTE ON FUNCTION public.get_token_admin_summary() TO authenticated;
