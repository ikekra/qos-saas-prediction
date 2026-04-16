-- Run Test compatibility migration.
-- Reassert the tables and columns used by the QoS test flow so a partial or
-- stale remote schema does not break the page with schema cache errors.

alter table if exists public.tests
  add column if not exists service_url text,
  add column if not exists test_type text,
  add column if not exists latency numeric,
  add column if not exists uptime numeric,
  add column if not exists throughput numeric,
  add column if not exists success_rate numeric,
  add column if not exists status text default 'completed',
  add column if not exists error_message text,
  add column if not exists created_at timestamptz not null default now();

alter table if exists public.qos_predictions
  add column if not exists service_id uuid references public.web_services(id) on delete set null;

alter table if exists public.web_services
  add column if not exists base_url text,
  add column if not exists docs_url text;

alter table if exists public.performance_run_cycles
  add column if not exists account_manager_webhook text,
  add column if not exists soft_limit_alerted_at timestamptz,
  add column if not exists hard_limit_alerted_at timestamptz;

alter table if exists public.performance_test_run_logs
  add column if not exists team_id uuid references public.teams(id) on delete set null,
  add column if not exists actor_user_id uuid references auth.users(id) on delete set null,
  add column if not exists test_run_id uuid references public.tests(id) on delete set null;

alter table if exists public.user_profiles
  add column if not exists performance_plan text default 'standard'
    check (performance_plan in ('standard', 'pro', 'enterprise')),
  add column if not exists performance_run_limit integer,
  add column if not exists performance_cycle_reset_at date,
  add column if not exists performance_org_id text,
  add column if not exists account_manager_webhook text;

alter table if exists public.tests enable row level security;
alter table if exists public.qos_predictions enable row level security;
alter table if exists public.web_services enable row level security;
alter table if exists public.performance_run_cycles enable row level security;
alter table if exists public.performance_test_run_logs enable row level security;

grant select on table public.tests to authenticated;
grant select on table public.qos_predictions to authenticated;
grant select on table public.web_services to anon, authenticated;
grant select on table public.performance_run_cycles to authenticated;
grant select on table public.performance_test_run_logs to authenticated;
