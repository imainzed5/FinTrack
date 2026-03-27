-- Accounts/Wallets release: multi-account support with atomic transfer RPC.

-- 1) Accounts table
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  type text not null check (type in ('Cash', 'Bank', 'E-Wallet', 'Other')),
  initial_balance numeric(12,2) not null default 0,
  color text,
  icon text,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger accounts_set_updated_at
before update on public.accounts
for each row
execute function public.set_updated_at();

-- 2) Add columns to transactions
alter table public.transactions
  add column if not exists account_id uuid references public.accounts (id),
  add column if not exists transfer_group_id uuid;

-- 3) Add indexes
create index if not exists transactions_user_account_date_idx
  on public.transactions (user_id, account_id, transaction_at desc);

create index if not exists transactions_transfer_group_idx
  on public.transactions (transfer_group_id);

create index if not exists accounts_user_archived_idx
  on public.accounts (user_id, is_archived);

-- 4) Insert default Cash account for each existing user without one.
insert into public.accounts (user_id, name, type, initial_balance)
select p.id, 'Cash', 'Cash', 0
from public.profiles p
where not exists (
  select 1
  from public.accounts a
  where a.user_id = p.id
);

-- 5) Backfill transactions.account_id to each user's default Cash account.
with default_cash as (
  select distinct on (a.user_id)
    a.user_id,
    a.id as account_id
  from public.accounts a
  where a.name = 'Cash'
    and a.type = 'Cash'
  order by a.user_id, a.created_at asc
)
update public.transactions t
set account_id = dc.account_id
from default_cash dc
where t.user_id = dc.user_id
  and t.account_id is null;

-- Ensure a transaction cannot be linked to another user's account.
create or replace function public.enforce_transaction_account_ownership()
returns trigger
language plpgsql
as $$
declare
  account_owner uuid;
begin
  if new.account_id is null then
    return new;
  end if;

  select a.user_id
  into account_owner
  from public.accounts a
  where a.id = new.account_id;

  if account_owner is null then
    raise exception 'Account not found.';
  end if;

  if account_owner <> new.user_id then
    raise exception 'Transaction account must belong to the same user.';
  end if;

  return new;
end;
$$;

drop trigger if exists transactions_enforce_account_ownership on public.transactions;
create trigger transactions_enforce_account_ownership
before insert or update of user_id, account_id on public.transactions
for each row
execute function public.enforce_transaction_account_ownership();

-- 6) create_transfer RPC (atomic debit + credit using one transfer_group_id)
create or replace function public.create_transfer(
  p_from_account_id uuid,
  p_to_account_id uuid,
  p_amount numeric,
  p_date timestamptz default now(),
  p_notes text default '',
  p_metadata jsonb default null
)
returns table (
  transfer_group_id uuid,
  debit_transaction_id uuid,
  credit_transaction_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_transfer_group_id uuid := gen_random_uuid();
  v_now timestamptz := now();
  v_from_id uuid;
  v_to_id uuid;
  v_debit_id uuid := gen_random_uuid();
  v_credit_id uuid := gen_random_uuid();
  v_notes text := coalesce(trim(p_notes), '');
  v_desc text;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentication required.';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Transfer amount must be greater than zero.';
  end if;

  if p_from_account_id is null or p_to_account_id is null then
    raise exception 'Both from and to accounts are required.';
  end if;

  if p_from_account_id = p_to_account_id then
    raise exception 'Cannot transfer to the same account.';
  end if;

  select a.id
  into v_from_id
  from public.accounts a
  where a.id = p_from_account_id
    and a.user_id = v_user_id
    and a.is_archived = false;

  if v_from_id is null then
    raise exception 'From account is invalid.';
  end if;

  select a.id
  into v_to_id
  from public.accounts a
  where a.id = p_to_account_id
    and a.user_id = v_user_id
    and a.is_archived = false;

  if v_to_id is null then
    raise exception 'To account is invalid.';
  end if;

  v_desc := case
    when v_notes <> '' then v_notes
    else 'Transfer between accounts'
  end;

  insert into public.transactions (
    id,
    user_id,
    amount,
    type,
    category,
    sub_category,
    merchant,
    description,
    transaction_at,
    payment_method,
    notes,
    tags,
    account_id,
    transfer_group_id,
    synced,
    created_at,
    updated_at
  )
  values (
    v_debit_id,
    v_user_id,
    p_amount,
    'expense',
    'Miscellaneous',
    'Transfer Out',
    null,
    v_desc,
    coalesce(p_date, now()),
    'Bank Transfer',
    v_notes,
    '{}',
    v_from_id,
    v_transfer_group_id,
    true,
    v_now,
    v_now
  );

  insert into public.transactions (
    id,
    user_id,
    amount,
    type,
    category,
    sub_category,
    merchant,
    description,
    transaction_at,
    payment_method,
    notes,
    tags,
    account_id,
    transfer_group_id,
    synced,
    created_at,
    updated_at
  )
  values (
    v_credit_id,
    v_user_id,
    p_amount,
    'income',
    'Miscellaneous',
    'Transfer In',
    null,
    v_desc,
    coalesce(p_date, now()),
    'Bank Transfer',
    v_notes,
    '{}',
    v_to_id,
    v_transfer_group_id,
    true,
    v_now,
    v_now
  );

  transfer_group_id := v_transfer_group_id;
  debit_transaction_id := v_debit_id;
  credit_transaction_id := v_credit_id;
  return next;
end;
$$;

revoke all on function public.create_transfer(uuid, uuid, numeric, timestamptz, text, jsonb) from public;
grant execute on function public.create_transfer(uuid, uuid, numeric, timestamptz, text, jsonb) to authenticated;

-- Keep transactions.account_id nullable in this release (no NOT NULL constraint).

-- 8) RLS policies for accounts
alter table public.accounts enable row level security;

create policy accounts_select_own
on public.accounts
for select
using (auth.uid() = user_id);

create policy accounts_insert_own
on public.accounts
for insert
with check (auth.uid() = user_id);

create policy accounts_update_own
on public.accounts
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy accounts_delete_own
on public.accounts
for delete
using (auth.uid() = user_id);

-- Ensure new users get a default Cash account immediately.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;

  insert into public.user_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  insert into public.accounts (user_id, name, type, initial_balance)
  values (new.id, 'Cash', 'Cash', 0)
  on conflict do nothing;

  return new;
end;
$$;
