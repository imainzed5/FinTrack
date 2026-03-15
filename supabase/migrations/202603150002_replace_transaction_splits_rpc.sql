-- Helper RPC for safely replacing split lines in a single transaction.
create or replace function public.replace_transaction_splits(
  p_transaction_id uuid,
  p_splits jsonb
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  split_line jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  if not exists (
    select 1
    from public.transactions t
    where t.id = p_transaction_id
      and t.user_id = auth.uid()
  ) then
    raise exception 'Transaction not found or access denied.';
  end if;

  if p_splits is null then
    p_splits := '[]'::jsonb;
  end if;

  if jsonb_typeof(p_splits) <> 'array' then
    raise exception 'Split payload must be a JSON array.';
  end if;

  if jsonb_array_length(p_splits) = 1 then
    raise exception 'Split transactions require at least 2 lines.';
  end if;

  delete from public.transaction_splits
  where transaction_id = p_transaction_id;

  if jsonb_array_length(p_splits) = 0 then
    perform public.validate_transaction_split_totals(p_transaction_id);
    return;
  end if;

  for split_line in
    select value
    from jsonb_array_elements(p_splits)
  loop
    if (split_line ? 'category') is false then
      raise exception 'Each split line must include category.';
    end if;

    if (split_line ? 'amount') is false then
      raise exception 'Each split line must include amount.';
    end if;

    insert into public.transaction_splits (
      id,
      transaction_id,
      category,
      sub_category,
      amount
    )
    values (
      coalesce(nullif(split_line ->> 'id', '')::uuid, gen_random_uuid()),
      p_transaction_id,
      (split_line ->> 'category')::public.expense_category,
      nullif(split_line ->> 'subCategory', ''),
      round((split_line ->> 'amount')::numeric, 2)
    );
  end loop;

  perform public.validate_transaction_split_totals(p_transaction_id);
end;
$$;
