do $$
begin
  if exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'performance_test_run_logs'
      and constraint_type = 'CHECK'
      and constraint_name = 'performance_test_run_logs_quota_scope_type_check'
  ) then
    alter table public.performance_test_run_logs
      drop constraint performance_test_run_logs_quota_scope_type_check;
  end if;
end $$;

alter table if exists public.performance_test_run_logs
  add constraint performance_test_run_logs_quota_scope_type_check
  check (quota_scope_type in ('user', 'org', 'team'));
