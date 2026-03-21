-- Add savings as a valid transaction type and store savings transaction metadata.
alter table public.transactions
  drop constraint transactions_type_check;

alter table public.transactions
  add constraint transactions_type_check
  check (type in ('expense', 'income', 'savings'));

alter table public.transactions
  add column if not exists savings_meta jsonb default null;
