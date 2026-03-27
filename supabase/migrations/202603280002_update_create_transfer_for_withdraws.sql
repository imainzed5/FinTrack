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

  select
    a.initial_balance + coalesce(sum(
      case
        when t.type = 'income' then t.amount
        when t.type = 'expense' then -t.amount
        when t.type = 'savings' and coalesce(t.savings_meta->>'depositType', '') = 'withdrawal' then t.amount
        when t.type = 'savings' then -t.amount
        else 0
      end
    ), 0)
  into v_from_balance
  from public.accounts a
  left join public.transactions t on t.account_id = a.id
  where a.id = v_from_id
  group by a.initial_balance;

  if coalesce(v_from_balance, 0) < p_amount then
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
    v_credit_sub_category,
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
