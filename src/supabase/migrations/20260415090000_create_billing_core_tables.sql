-- Foundational billing/profile tables referenced by app code and later migrations.

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

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'user_profiles' and column_name = 'performance_plan'
  ) then
    alter table public.user_profiles
      drop constraint if exists user_profiles_performance_plan_check;
    alter table public.user_profiles
      add constraint user_profiles_performance_plan_check
      check (performance_plan in ('standard', 'pro', 'enterprise'));
  end if;
end $$;

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

alter table if exists public.token_transactions
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists type text,
  add column if not exists amount numeric,
  add column if not exists balance_after numeric,
  add column if not exists description text,
  add column if not exists endpoint text,
  add column if not exists created_at timestamptz not null default now();

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan text not null check (plan in ('standard', 'pro', 'enterprise')),
  status text not null check (status in ('trialing', 'active', 'past_due', 'cancelled', 'expired')),
  razorpay_sub_id text unique,
  current_period_start timestamptz not null default now(),
  current_period_end timestamptz not null default (now() + interval '1 month'),
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  gateway_order_id text,
  gateway_payment_id text,
  razorpay_order_id text,
  razorpay_payment_id text,
  amount_in_paise integer not null default 0 check (amount_in_paise >= 0),
  currency text not null default 'INR',
  status text not null default 'pending' check (status in ('pending', 'success', 'failed', 'refunded')),
  pack_name text,
  plan_name text,
  idempotency_key text,
  tokens_purchased integer not null default 0 check (tokens_purchased >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (gateway_order_id),
  unique (gateway_payment_id),
  unique (razorpay_order_id),
  unique (razorpay_payment_id),
  unique (idempotency_key)
);

alter table if exists public.payments
  add column if not exists subscription_id uuid references public.subscriptions(id) on delete set null,
  add column if not exists gateway_order_id text,
  add column if not exists gateway_payment_id text,
  add column if not exists razorpay_order_id text,
  add column if not exists razorpay_payment_id text,
  add column if not exists amount_in_paise integer not null default 0,
  add column if not exists currency text not null default 'INR',
  add column if not exists status text not null default 'pending',
  add column if not exists pack_name text,
  add column if not exists plan_name text,
  add column if not exists idempotency_key text,
  add column if not exists tokens_purchased integer not null default 0,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'payments' and column_name = 'status'
  ) then
    alter table public.payments
      drop constraint if exists payments_status_check;
    alter table public.payments
      add constraint payments_status_check
      check (status in ('pending', 'success', 'failed', 'refunded'));
  end if;
end $$;

create unique index if not exists idx_user_profiles_email_unique
  on public.user_profiles (lower(email));

create index if not exists idx_token_transactions_user_created
  on public.token_transactions (user_id, created_at desc);

create index if not exists idx_subscriptions_user_status
  on public.subscriptions (user_id, status);

create index if not exists idx_payments_user_created
  on public.payments (user_id, created_at desc);

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'payments' and column_name = 'subscription_id'
  ) then
    execute 'create index if not exists idx_payments_subscription_created on public.payments (subscription_id, created_at desc)';
  end if;
end $$;

alter table public.user_profiles enable row level security;
alter table public.token_transactions enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payments enable row level security;

do $$
begin
  if exists (
    select 1
    from pg_proc
    where proname = 'update_updated_at_column'
      and pg_function_is_visible(oid)
  ) then
    if not exists (select 1 from pg_trigger where tgname = 'update_user_profiles_updated_at') then
      create trigger update_user_profiles_updated_at
      before update on public.user_profiles
      for each row execute function public.update_updated_at_column();
    end if;

    if not exists (select 1 from pg_trigger where tgname = 'update_subscriptions_updated_at') then
      create trigger update_subscriptions_updated_at
      before update on public.subscriptions
      for each row execute function public.update_updated_at_column();
    end if;

    if not exists (select 1 from pg_trigger where tgname = 'update_payments_updated_at') then
      create trigger update_payments_updated_at
      before update on public.payments
      for each row execute function public.update_updated_at_column();
    end if;
  end if;
end $$;

drop policy if exists user_profiles_select_own on public.user_profiles;
create policy user_profiles_select_own
  on public.user_profiles for select
  using (auth.uid() = id);

drop policy if exists token_transactions_select_own on public.token_transactions;
create policy token_transactions_select_own
  on public.token_transactions for select
  using (auth.uid() = user_id);

drop policy if exists subscriptions_select_own on public.subscriptions;
create policy subscriptions_select_own
  on public.subscriptions for select
  using (auth.uid() = user_id);

drop policy if exists payments_select_own on public.payments;
create policy payments_select_own
  on public.payments for select
  using (auth.uid() = user_id);

grant select on public.user_profiles to authenticated;
grant select on public.token_transactions to authenticated;
grant select on public.subscriptions to authenticated;
grant select on public.payments to authenticated;
