-- Add first-class transaction type support for expense/income flows.
alter table public.transactions
  add column type text;

update public.transactions
set type = 'expense'
where type is null;

alter table public.transactions
  alter column type set default 'expense',
  alter column type set not null;

alter table public.transactions
  add constraint transactions_type_check
  check (type in ('expense', 'income'));
