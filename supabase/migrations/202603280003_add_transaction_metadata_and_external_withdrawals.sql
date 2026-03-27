alter table public.transactions
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists linked_transfer_group_id uuid;

create index if not exists transactions_linked_transfer_group_idx
  on public.transactions (linked_transfer_group_id);

create table if not exists public.external_withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  from_account_id uuid not null references public.accounts (id) on delete restrict,
  amount numeric(12,2) not null check (amount > 0),
  fee_amount numeric(12,2) not null default 0 check (fee_amount >= 0),
  net_amount numeric(12,2) not null check (net_amount >= 0),
  destination_summary text not null,
  status text not null check (status in ('pending', 'completed', 'failed', 'cancelled')),
  provider_ref text,
  eta_at timestamptz,
  idempotency_key text not null,
  failure_reason text,
  completed_transaction_id uuid references public.transactions (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, idempotency_key),
  check (net_amount <= amount)
);

create index if not exists external_withdrawal_requests_user_created_idx
  on public.external_withdrawal_requests (user_id, created_at desc);

create index if not exists external_withdrawal_requests_user_status_idx
  on public.external_withdrawal_requests (user_id, status, created_at desc);

drop trigger if exists external_withdrawal_requests_set_updated_at on public.external_withdrawal_requests;
create trigger external_withdrawal_requests_set_updated_at
before update on public.external_withdrawal_requests
for each row
execute function public.set_updated_at();

alter table public.external_withdrawal_requests enable row level security;

drop policy if exists external_withdrawal_requests_select_own on public.external_withdrawal_requests;
create policy external_withdrawal_requests_select_own
on public.external_withdrawal_requests
for select
using (auth.uid() = user_id);

drop policy if exists external_withdrawal_requests_insert_own on public.external_withdrawal_requests;
create policy external_withdrawal_requests_insert_own
on public.external_withdrawal_requests
for insert
with check (auth.uid() = user_id);

drop policy if exists external_withdrawal_requests_update_own on public.external_withdrawal_requests;
create policy external_withdrawal_requests_update_own
on public.external_withdrawal_requests
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create or replace function public.current_account_balance(p_account_id uuid)
returns numeric
language sql
stable
set search_path = public
as $$
  select coalesce(a.initial_balance, 0) + coalesce(sum(
    case
      when t.type = 'income' then t.amount
      when t.type = 'expense' then -t.amount
      when t.type = 'savings' and coalesce(t.savings_meta->>'depositType', '') = 'withdrawal' then t.amount
      when t.type = 'savings' then -t.amount
      else 0
    end
  ), 0)
  from public.accounts a
  left join public.transactions t on t.account_id = a.id
  where a.id = p_account_id
  group by a.initial_balance
$$;

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
  v_destination_type text := lower(coalesce(trim(p_metadata->>'destinationType'), 'internal'));
  v_from_balance numeric := 0;
  v_debit_sub_category text := 'Transfer Out';
  v_credit_sub_category text := 'Transfer In';
  v_metadata jsonb := coalesce(p_metadata, '{}'::jsonb);
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

  if v_destination_type not in ('cash', 'internal') then
    raise exception 'Invalid transfer destination.';
  end if;

  select a.id
  into v_from_id
  from public.accounts a
  where a.id = p_from_account_id
    and a.user_id = v_user_id
    and a.is_archived = false
  for update;

  if v_from_id is null then
    raise exception 'From account is invalid.';
  end if;

  select a.id
  into v_to_id
  from public.accounts a
  where a.id = p_to_account_id
    and a.user_id = v_user_id
    and a.is_archived = false
  for update;

  if v_to_id is null then
    raise exception 'To account is invalid.';
  end if;

  select coalesce(public.current_account_balance(v_from_id), 0)
  into v_from_balance;

  if v_from_balance < p_amount then
    raise exception 'Insufficient balance.';
  end if;

  if v_destination_type = 'cash' then
    v_debit_sub_category := 'Cash Withdrawal';
    v_credit_sub_category := 'Cash Deposit';
  end if;

  v_desc := case
    when v_notes <> '' then v_notes
    when v_destination_type = 'cash' then 'Moved to Cash wallet'
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
    metadata,
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
    v_debit_sub_category,
    null,
    v_desc,
    coalesce(p_date, now()),
    'Bank Transfer',
    v_notes,
    '{}',
    v_from_id,
    v_transfer_group_id,
    v_metadata,
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
    metadata,
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
    v_credit_sub_category,
    null,
    v_desc,
    coalesce(p_date, now()),
    'Bank Transfer',
    v_notes,
    '{}',
    v_to_id,
    v_transfer_group_id,
    v_metadata,
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

create or replace function public.create_external_withdrawal_request(
  p_from_account_id uuid,
  p_amount numeric,
  p_fee_amount numeric default 0,
  p_destination_summary text default '',
  p_eta_at timestamptz default null,
  p_idempotency_key text default null,
  p_metadata jsonb default null
)
returns setof public.external_withdrawal_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_request_id uuid := gen_random_uuid();
  v_from_id uuid;
  v_balance numeric := 0;
  v_metadata jsonb := coalesce(p_metadata, '{}'::jsonb);
  v_idempotency_key text := coalesce(nullif(trim(p_idempotency_key), ''), gen_random_uuid()::text);
  v_destination_summary text := coalesce(trim(p_destination_summary), '');
  v_net_amount numeric := round(p_amount - coalesce(p_fee_amount, 0), 2);
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentication required.';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Withdrawal amount must be greater than zero.';
  end if;

  if p_fee_amount is null or p_fee_amount < 0 then
    raise exception 'Fee amount must be zero or greater.';
  end if;

  if v_net_amount <= 0 then
    raise exception 'Fee amount must be lower than the withdrawal amount.';
  end if;

  if v_destination_summary = '' then
    raise exception 'Destination summary is required.';
  end if;

  select a.id
  into v_from_id
  from public.accounts a
  where a.id = p_from_account_id
    and a.user_id = v_user_id
    and a.is_archived = false
  for update;

  if v_from_id is null then
    raise exception 'From account is invalid.';
  end if;

  select coalesce(public.current_account_balance(v_from_id), 0)
  into v_balance;

  if v_balance < p_amount then
    raise exception 'Insufficient balance.';
  end if;

  return query
  insert into public.external_withdrawal_requests (
    id,
    user_id,
    from_account_id,
    amount,
    fee_amount,
    net_amount,
    destination_summary,
    status,
    eta_at,
    idempotency_key,
    metadata,
    created_by,
    created_at,
    updated_at
  )
  values (
    v_request_id,
    v_user_id,
    v_from_id,
    round(p_amount, 2),
    round(coalesce(p_fee_amount, 0), 2),
    v_net_amount,
    v_destination_summary,
    'pending',
    p_eta_at,
    v_idempotency_key,
    v_metadata,
    v_user_id,
    now(),
    now()
  )
  on conflict (user_id, idempotency_key)
  do update set updated_at = now()
  returning *;
end;
$$;

create or replace function public.complete_external_withdrawal_request(
  p_request_id uuid,
  p_provider_ref text default null,
  p_metadata jsonb default null
)
returns setof public.external_withdrawal_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_request public.external_withdrawal_requests%rowtype;
  v_balance numeric := 0;
  v_transaction_id uuid := gen_random_uuid();
  v_metadata jsonb := '{}'::jsonb;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentication required.';
  end if;

  select *
  into v_request
  from public.external_withdrawal_requests r
  where r.id = p_request_id
    and r.user_id = v_user_id
  for update;

  if v_request.id is null then
    raise exception 'External withdrawal request not found.';
  end if;

  if v_request.status <> 'pending' then
    return query
    select *
    from public.external_withdrawal_requests
    where id = v_request.id;
    return;
  end if;

  select coalesce(public.current_account_balance(v_request.from_account_id), 0)
  into v_balance;

  if v_balance < v_request.amount then
    raise exception 'Insufficient balance.';
  end if;

  v_metadata := coalesce(v_request.metadata, '{}'::jsonb)
    || coalesce(p_metadata, '{}'::jsonb)
    || jsonb_build_object(
      'destinationType', 'external',
      'externalWithdrawalRequestId', v_request.id::text
    );

  if p_provider_ref is not null and trim(p_provider_ref) <> '' then
    v_metadata := v_metadata || jsonb_build_object('providerRef', trim(p_provider_ref));
  end if;

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
    metadata,
    synced,
    created_at,
    updated_at
  )
  values (
    v_transaction_id,
    v_user_id,
    v_request.amount,
    'expense',
    'Miscellaneous',
    'External Withdrawal',
    null,
    'External withdrawal to ' || v_request.destination_summary,
    now(),
    'Bank Transfer',
    coalesce(v_request.metadata->>'notes', ''),
    '{}',
    v_request.from_account_id,
    v_request.id,
    v_metadata,
    true,
    now(),
    now()
  );

  update public.external_withdrawal_requests
  set
    status = 'completed',
    provider_ref = coalesce(nullif(trim(p_provider_ref), ''), provider_ref),
    completed_transaction_id = v_transaction_id,
    metadata = v_metadata,
    updated_at = now()
  where id = v_request.id;

  return query
  select *
  from public.external_withdrawal_requests
  where id = v_request.id;
end;
$$;

create or replace function public.fail_external_withdrawal_request(
  p_request_id uuid,
  p_failure_reason text default 'External withdrawal failed.',
  p_provider_ref text default null,
  p_metadata jsonb default null
)
returns setof public.external_withdrawal_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_request public.external_withdrawal_requests%rowtype;
  v_metadata jsonb := '{}'::jsonb;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentication required.';
  end if;

  select *
  into v_request
  from public.external_withdrawal_requests r
  where r.id = p_request_id
    and r.user_id = v_user_id
  for update;

  if v_request.id is null then
    raise exception 'External withdrawal request not found.';
  end if;

  v_metadata := coalesce(v_request.metadata, '{}'::jsonb) || coalesce(p_metadata, '{}'::jsonb);

  if p_provider_ref is not null and trim(p_provider_ref) <> '' then
    v_metadata := v_metadata || jsonb_build_object('providerRef', trim(p_provider_ref));
  end if;

  update public.external_withdrawal_requests
  set
    status = 'failed',
    failure_reason = coalesce(nullif(trim(p_failure_reason), ''), failure_reason, 'External withdrawal failed.'),
    provider_ref = coalesce(nullif(trim(p_provider_ref), ''), provider_ref),
    metadata = v_metadata,
    updated_at = now()
  where id = v_request.id;

  return query
  select *
  from public.external_withdrawal_requests
  where id = v_request.id;
end;
$$;

revoke all on function public.create_external_withdrawal_request(uuid, numeric, numeric, text, timestamptz, text, jsonb) from public;
grant execute on function public.create_external_withdrawal_request(uuid, numeric, numeric, text, timestamptz, text, jsonb) to authenticated;

revoke all on function public.complete_external_withdrawal_request(uuid, text, jsonb) from public;
grant execute on function public.complete_external_withdrawal_request(uuid, text, jsonb) to authenticated;

revoke all on function public.fail_external_withdrawal_request(uuid, text, text, jsonb) from public;
grant execute on function public.fail_external_withdrawal_request(uuid, text, text, jsonb) to authenticated;
