-- Normalize high-risk FK/index/constraint gaps without destructive renames.

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'services_created_by_fkey'
      and conrelid = 'public.services'::regclass
  ) then
    alter table public.services
      add constraint services_created_by_fkey
      foreign key (created_by) references auth.users(id) on delete set null;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'ratings_user_id_fkey'
      and conrelid = 'public.ratings'::regclass
  ) then
    alter table public.ratings
      add constraint ratings_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'test_results_user_id_fkey'
      and conrelid = 'public.test_results'::regclass
  ) then
    alter table public.test_results
      add constraint test_results_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'user_favorites_user_id_fkey'
      and conrelid = 'public.user_favorites'::regclass
  ) then
    alter table public.user_favorites
      add constraint user_favorites_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade;
  end if;
end $$;

do $$
begin
  if to_regclass('public.performance_test_run_logs') is not null
    and not exists (
      select 1 from pg_constraint
      where conname = 'performance_test_run_logs_user_id_fkey'
        and conrelid = 'public.performance_test_run_logs'::regclass
    ) then
    alter table public.performance_test_run_logs
      add constraint performance_test_run_logs_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade;
  end if;
end $$;

alter table public.profiles add column if not exists deleted_at timestamptz;
alter table public.projects add column if not exists deleted_at timestamptz;
alter table public.services add column if not exists deleted_at timestamptz;
alter table public.web_services add column if not exists deleted_at timestamptz;
alter table public.team_members add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'tests_status_check'
      and conrelid = 'public.tests'::regclass
  ) then
    alter table public.tests
      add constraint tests_status_check
      check (status in ('completed', 'failed', 'pending'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'test_results_status_check'
      and conrelid = 'public.test_results'::regclass
  ) then
    alter table public.test_results
      add constraint test_results_status_check
      check (status in ('completed', 'failed', 'pending'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'marketing_leads_status_check'
      and conrelid = 'public.marketing_leads'::regclass
  ) then
    alter table public.marketing_leads
      add constraint marketing_leads_status_check
      check (status in ('new', 'contacted', 'qualified', 'closed'));
  end if;
end $$;

create unique index if not exists idx_profiles_email_unique
  on public.profiles (lower(email));

do $$
begin
  if to_regclass('public.projects') is not null then
    execute 'create index if not exists idx_projects_owner on public.projects(owner)';
  end if;

  if to_regclass('public.tests') is not null then
    execute 'create index if not exists idx_tests_user_type_created on public.tests(user_id, test_type, created_at desc)';
  end if;

  if to_regclass('public.user_favorites') is not null then
    execute 'create index if not exists idx_user_favorites_service_id on public.user_favorites(service_id)';
  end if;

  if to_regclass('public.web_service_ratings') is not null then
    execute 'create index if not exists idx_web_service_ratings_service_id on public.web_service_ratings(service_id)';
  end if;

  if to_regclass('public.web_service_favorites') is not null then
    execute 'create index if not exists idx_web_service_favorites_service_id on public.web_service_favorites(service_id)';
  end if;

  if to_regclass('public.team_invitations') is not null then
    execute 'create index if not exists idx_team_invitations_team_status_created on public.team_invitations(team_id, status, created_at desc)';
  end if;
end $$;
