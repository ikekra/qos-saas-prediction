-- Team management, shared quota, admin analytics support, and append-only audit logs.

create extension if not exists pgcrypto;

create or replace function public.is_admin_user(check_user_id uuid default auth.uid())
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = check_user_id
      and coalesce(lower(p.role), '') = 'admin'
  )
  or coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'team_plan') then
    create type public.team_plan as enum ('pro', 'enterprise');
  end if;

  if not exists (select 1 from pg_type where typname = 'team_member_role') then
    create type public.team_member_role as enum ('owner', 'admin', 'member');
  end if;

  if not exists (select 1 from pg_type where typname = 'team_member_status') then
    create type public.team_member_status as enum ('active', 'invited', 'suspended', 'removed');
  end if;

  if not exists (select 1 from pg_type where typname = 'team_invitation_status') then
    create type public.team_invitation_status as enum ('pending', 'accepted', 'declined', 'revoked', 'expired');
  end if;

  if not exists (select 1 from pg_type where typname = 'admin_action_status') then
    create type public.admin_action_status as enum ('attempt', 'success', 'failed', 'denied');
  end if;
end $$;

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name varchar(100) not null,
  slug varchar(100) not null unique,
  owner_id uuid not null references auth.users(id) on delete restrict,
  plan public.team_plan not null,
  max_members integer not null default 4 check (max_members between 4 and 5),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.team_member_role not null default 'member',
  invited_by uuid references auth.users(id) on delete set null,
  joined_at timestamptz,
  status public.team_member_status not null default 'invited',
  created_at timestamptz not null default now(),
  unique (team_id, user_id)
);

create or replace function public.current_team_member_count(p_team_id uuid)
returns integer
language sql
stable
as $$
  select count(*)::integer
  from public.team_members
  where team_id = p_team_id
    and status in ('active', 'invited')
$$;

create table if not exists public.team_invitations (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  invited_email varchar(255) not null,
  invited_by uuid not null references auth.users(id) on delete cascade,
  token varchar(64) not null unique,
  role public.team_member_role not null default 'member',
  status public.team_invitation_status not null default 'pending',
  expires_at timestamptz not null,
  accepted_at timestamptz,
  declined_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.team_activity_logs (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete restrict,
  action varchar(100) not null,
  resource_type varchar(50),
  resource_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.quota_usage (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  cycle_start_date date not null,
  cycle_end_date date not null,
  run_limit integer not null check (run_limit > 0),
  runs_used integer not null default 0 check (runs_used >= 0),
  reset_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (team_id, cycle_start_date)
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references auth.users(id) on delete restrict,
  action text not null,
  target_type text not null,
  target_id text,
  before jsonb,
  after jsonb,
  ip text,
  created_at timestamptz not null default now()
);

create index if not exists idx_teams_owner_id on public.teams(owner_id);
create index if not exists idx_teams_slug on public.teams(slug);
create index if not exists idx_team_members_team_id on public.team_members(team_id);
create index if not exists idx_team_members_user_id on public.team_members(user_id);
create index if not exists idx_team_members_status on public.team_members(status);
create index if not exists idx_team_invitations_token on public.team_invitations(token);
create index if not exists idx_team_invitations_team_id on public.team_invitations(team_id);
create index if not exists idx_team_invitations_invited_email on public.team_invitations(invited_email);
create index if not exists idx_team_activity_logs_team_created on public.team_activity_logs(team_id, created_at desc);
create index if not exists idx_team_activity_logs_actor_created on public.team_activity_logs(actor_id, created_at desc);
create index if not exists idx_quota_usage_team_cycle on public.quota_usage(team_id, cycle_start_date desc);
create index if not exists idx_audit_logs_created_at on public.audit_logs(created_at desc);
create index if not exists idx_audit_logs_admin_action on public.audit_logs(admin_id, action, created_at desc);
create index if not exists idx_audit_logs_target on public.audit_logs(target_type, target_id, created_at desc);

alter table if exists public.payments
  add column if not exists team_id uuid references public.teams(id) on delete set null,
  add column if not exists subscription_type text default 'individual',
  add column if not exists plan_name text;

do $$
begin
  if to_regclass('public.payments') is not null then
    execute 'create index if not exists idx_payments_team_created on public.payments(team_id, created_at desc)';
    execute 'create index if not exists idx_payments_status_created on public.payments(status, created_at desc)';
    execute 'create index if not exists idx_payments_user_created on public.payments(user_id, created_at desc)';
  end if;
end $$;

alter table if exists public.performance_test_run_logs
  add column if not exists team_id uuid references public.teams(id) on delete set null,
  add column if not exists actor_user_id uuid references auth.users(id) on delete set null,
  add column if not exists test_run_id uuid references public.tests(id) on delete set null;

do $$
begin
  if to_regclass('public.performance_test_run_logs') is not null then
    execute 'create index if not exists idx_performance_test_run_logs_team_created on public.performance_test_run_logs(team_id, created_at desc)';
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from pg_proc
    where proname = 'update_updated_at_column'
      and pg_function_is_visible(oid)
  ) then
    if not exists (select 1 from pg_trigger where tgname = 'update_teams_updated_at') then
      create trigger update_teams_updated_at
      before update on public.teams
      for each row execute function public.update_updated_at_column();
    end if;

    if not exists (select 1 from pg_trigger where tgname = 'update_quota_usage_updated_at') then
      create trigger update_quota_usage_updated_at
      before update on public.quota_usage
      for each row execute function public.update_updated_at_column();
    end if;
  end if;
end $$;

create or replace function public.sync_team_max_members()
returns trigger
language plpgsql
as $$
begin
  new.max_members := case when new.plan = 'enterprise' then 5 else 4 end;
  return new;
end;
$$;

drop trigger if exists sync_team_max_members_trigger on public.teams;
create trigger sync_team_max_members_trigger
before insert or update of plan on public.teams
for each row execute function public.sync_team_max_members();

create or replace function public.log_team_activity(
  p_team_id uuid,
  p_actor_id uuid,
  p_action text,
  p_resource_type text default null,
  p_resource_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
as $$
begin
  insert into public.team_activity_logs (team_id, actor_id, action, resource_type, resource_id, metadata)
  values (p_team_id, p_actor_id, p_action, p_resource_type, p_resource_id, coalesce(p_metadata, '{}'::jsonb));
end;
$$;

create or replace function public.append_audit_log(
  p_admin_id uuid,
  p_action text,
  p_target_type text,
  p_target_id text default null,
  p_before jsonb default null,
  p_after jsonb default null,
  p_ip text default null
)
returns void
language plpgsql
security definer
as $$
begin
  insert into public.audit_logs (admin_id, action, target_type, target_id, before, after, ip)
  values (p_admin_id, p_action, p_target_type, p_target_id, p_before, p_after, p_ip);
end;
$$;

create or replace function public.ensure_team_quota_cycle(
  p_team_id uuid,
  p_run_limit integer
)
returns public.quota_usage
language plpgsql
security definer
as $$
declare
  v_start date := date_trunc('month', now())::date;
  v_end date := (date_trunc('month', now()) + interval '1 month - 1 day')::date;
  v_reset timestamptz := date_trunc('month', now()) + interval '1 month';
  v_row public.quota_usage%rowtype;
begin
  insert into public.quota_usage (team_id, cycle_start_date, cycle_end_date, run_limit, runs_used, reset_at)
  values (p_team_id, v_start, v_end, p_run_limit, 0, v_reset)
  on conflict (team_id, cycle_start_date) do update
  set run_limit = excluded.run_limit,
      cycle_end_date = excluded.cycle_end_date,
      reset_at = excluded.reset_at
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.reserve_team_quota_run(
  p_team_id uuid,
  p_run_limit integer
)
returns table (
  success boolean,
  runs_used integer,
  runs_remaining integer,
  run_limit integer,
  reset_at timestamptz
)
language plpgsql
security definer
as $$
declare
  v_cycle public.quota_usage%rowtype;
begin
  select * into v_cycle
  from public.ensure_team_quota_cycle(p_team_id, p_run_limit);

  select * into v_cycle
  from public.quota_usage
  where id = v_cycle.id
  for update;

  if v_cycle.runs_used >= v_cycle.run_limit then
    return query
    select false, v_cycle.runs_used, 0, v_cycle.run_limit, v_cycle.reset_at;
    return;
  end if;

  update public.quota_usage
  set runs_used = runs_used + 1
  where id = v_cycle.id
  returning * into v_cycle;

  return query
  select true, v_cycle.runs_used, greatest(v_cycle.run_limit - v_cycle.runs_used, 0), v_cycle.run_limit, v_cycle.reset_at;
end;
$$;

create or replace function public.team_plan_run_limit(p_plan public.team_plan)
returns integer
language sql
immutable
as $$
  select case when p_plan = 'enterprise' then 950 else 500 end
$$;

create or replace view public.team_member_usage_breakdown as
select
  l.team_id,
  l.actor_user_id as user_id,
  count(*)::integer as runs_used,
  max(l.created_at) as last_active_at
from public.performance_test_run_logs l
where l.team_id is not null
  and l.actor_user_id is not null
group by l.team_id, l.actor_user_id;

create or replace view public.team_quota_overview as
select
  t.id as team_id,
  t.name as team_name,
  t.plan,
  t.max_members,
  q.cycle_start_date,
  q.cycle_end_date,
  q.run_limit,
  q.runs_used,
  greatest(q.run_limit - q.runs_used, 0) as runs_remaining,
  q.reset_at
from public.teams t
join public.quota_usage q on q.team_id = t.id
where t.deleted_at is null;

alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.team_invitations enable row level security;
alter table public.team_activity_logs enable row level security;
alter table public.quota_usage enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists teams_members_select on public.teams;
create policy teams_members_select
on public.teams
for select
using (
  exists (
    select 1
    from public.team_members tm
    where tm.team_id = teams.id
      and tm.user_id = auth.uid()
      and tm.status in ('active', 'invited')
  )
  or owner_id = auth.uid()
  or public.is_admin_user()
);

drop policy if exists team_members_visible_to_team on public.team_members;
create policy team_members_visible_to_team
on public.team_members
for select
using (
  exists (
    select 1
    from public.team_members tm
    where tm.team_id = team_members.team_id
      and tm.user_id = auth.uid()
      and tm.status in ('active', 'invited')
  )
  or public.is_admin_user()
);

drop policy if exists team_invitations_visible_to_team on public.team_invitations;
create policy team_invitations_visible_to_team
on public.team_invitations
for select
using (
  exists (
    select 1
    from public.team_members tm
    where tm.team_id = team_invitations.team_id
      and tm.user_id = auth.uid()
      and tm.status in ('active', 'invited')
  )
  or public.is_admin_user()
);

drop policy if exists team_activity_visible_to_team on public.team_activity_logs;
create policy team_activity_visible_to_team
on public.team_activity_logs
for select
using (
  exists (
    select 1
    from public.team_members tm
    where tm.team_id = team_activity_logs.team_id
      and tm.user_id = auth.uid()
      and tm.status in ('active', 'invited')
  )
  or public.is_admin_user()
);

drop policy if exists quota_usage_visible_to_team on public.quota_usage;
create policy quota_usage_visible_to_team
on public.quota_usage
for select
using (
  exists (
    select 1
    from public.team_members tm
    where tm.team_id = quota_usage.team_id
      and tm.user_id = auth.uid()
      and tm.status in ('active', 'invited')
  )
  or public.is_admin_user()
);

drop policy if exists audit_logs_admin_select on public.audit_logs;
create policy audit_logs_admin_select
on public.audit_logs
for select
using (public.is_admin_user());

grant select on public.teams to authenticated;
grant select on public.team_members to authenticated;
grant select on public.team_invitations to authenticated;
grant select on public.team_activity_logs to authenticated;
grant select on public.quota_usage to authenticated;
grant select on public.audit_logs to authenticated;
grant select on public.team_member_usage_breakdown to authenticated;
grant select on public.team_quota_overview to authenticated;
