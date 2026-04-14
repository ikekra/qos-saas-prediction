-- up
create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  token_balance integer not null default 0 check (token_balance >= 0),
  lifetime_tokens_used integer not null default 0 check (lifetime_tokens_used >= 0),
  performance_plan text not null default 'standard'
    check (performance_plan in ('standard', 'pro', 'enterprise')),
  performance_run_limit integer,
  performance_cycle_reset_at date,
  performance_org_id text,
  account_manager_webhook text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table if exists public.user_profiles
  add column if not exists email text,
  add column if not exists token_balance integer not null default 0,
  add column if not exists lifetime_tokens_used integer not null default 0,
  add column if not exists performance_plan text not null default 'standard',
  add column if not exists performance_run_limit integer,
  add column if not exists performance_cycle_reset_at date,
  add column if not exists performance_org_id text,
  add column if not exists account_manager_webhook text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists deleted_at timestamptz;

create unique index if not exists idx_user_profiles_email_unique
  on public.user_profiles (lower(email));

create index if not exists idx_user_profiles_plan
  on public.user_profiles (performance_plan);

create table if not exists public.token_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('credit', 'debit')),
  amount integer not null check (amount > 0),
  balance_after integer not null check (balance_after >= 0),
  description text not null,
  endpoint text,
  created_at timestamptz not null default now()
);

create index if not exists idx_token_transactions_user_created
  on public.token_transactions (user_id, created_at desc);

create index if not exists idx_token_transactions_user_type_created
  on public.token_transactions (user_id, type, created_at desc);

-- down
drop index if exists idx_token_transactions_user_type_created;
drop index if exists idx_token_transactions_user_created;
drop table if exists public.token_transactions;
drop index if exists idx_user_profiles_plan;
drop index if exists idx_user_profiles_email_unique;
drop table if exists public.user_profiles;
