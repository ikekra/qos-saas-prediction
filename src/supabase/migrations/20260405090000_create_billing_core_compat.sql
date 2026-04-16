-- Compatibility migration.
-- A later migration starts using public.user_profiles and public.token_transactions
-- before the full billing core migration creates them. On a fresh database, that
-- order causes schema setup to fail and later shows up as schema cache errors in
-- the top-up flow. Create the core tables early so dependent migrations can run.

create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  token_balance integer not null default 0 check (token_balance >= 0),
  lifetime_tokens_used integer not null default 0 check (lifetime_tokens_used >= 0),
  performance_plan text not null default 'standard'
    check (performance_plan in ('standard', 'pro', 'enterprise')),
  performance_run_limit integer check (performance_run_limit is null or performance_run_limit > 0),
  performance_cycle_reset_at date,
  performance_org_id text,
  account_manager_webhook text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.token_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('credit', 'debit')),
  amount numeric not null check (amount > 0),
  balance_after numeric not null check (balance_after >= 0),
  description text not null,
  endpoint text,
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  gateway_order_id text unique,
  gateway_payment_id text unique,
  razorpay_order_id text unique,
  razorpay_payment_id text unique,
  amount_in_paise integer not null default 0 check (amount_in_paise >= 0),
  currency text not null default 'INR',
  status text not null default 'pending' check (status in ('pending', 'success', 'failed', 'refunded')),
  pack_name text,
  plan_name text,
  idempotency_key text unique,
  tokens_purchased integer not null default 0 check (tokens_purchased >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
