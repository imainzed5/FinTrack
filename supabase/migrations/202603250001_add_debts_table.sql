-- Add debts/IOU ledger table for Debts & Splits feature.

create table if not exists public.debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  direction text not null check (direction in ('owed', 'owing')),
  person_name text not null,
  amount numeric(12,2) not null check (amount > 0),
  reason text not null,
  debt_date date not null default (now() at time zone 'utc')::date,
  status text not null default 'active' check (status in ('active', 'settled')),
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (status = 'active' and settled_at is null)
    or
    (status = 'settled' and settled_at is not null)
  )
);

create index if not exists debts_user_status_date_idx
  on public.debts (user_id, status, debt_date desc);

create index if not exists debts_user_direction_status_idx
  on public.debts (user_id, direction, status);

drop trigger if exists debts_set_updated_at on public.debts;
create trigger debts_set_updated_at
before update on public.debts
for each row
execute function public.set_updated_at();

create policy debts_select_own
on public.debts
for select
using (auth.uid() = user_id);

create policy debts_insert_own
on public.debts
for insert
with check (auth.uid() = user_id);

create policy debts_update_own
on public.debts
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy debts_delete_own
on public.debts
for delete
using (auth.uid() = user_id);
