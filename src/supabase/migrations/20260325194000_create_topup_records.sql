create table if not exists public.topup_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  account_user_id text not null,
  tokens_added integer not null check (tokens_added > 0),
  amount_paid integer not null check (amount_paid > 0),
  currency text not null default 'INR',
  package_selected text not null,
  notes text,
  billing_address text,
  gst_id text,
  status text not null default 'pending' check (status in ('pending', 'completed', 'failed')),
  payment_method text not null default 'manual',
  created_at timestamptz not null default now()
);

alter table public.topup_records enable row level security;

drop policy if exists "Users can view their topup records" on public.topup_records;
create policy "Users can view their topup records"
on public.topup_records
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their topup records" on public.topup_records;
create policy "Users can insert their topup records"
on public.topup_records
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their topup records" on public.topup_records;
create policy "Users can update their topup records"
on public.topup_records
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create index if not exists idx_topup_records_user_created_at
on public.topup_records(user_id, created_at desc);

