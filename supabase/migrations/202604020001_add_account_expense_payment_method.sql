alter table public.accounts
  add column if not exists expense_payment_method text;

alter table public.accounts
  drop constraint if exists accounts_expense_payment_method_check;

alter table public.accounts
  add constraint accounts_expense_payment_method_check
  check (
    expense_payment_method is null
    or expense_payment_method in ('Cash', 'Credit Card', 'Debit Card', 'GCash', 'Maya', 'Bank Transfer', 'Other')
  );

update public.accounts
set expense_payment_method = case
  when lower(name) like '%gcash%' then 'GCash'
  when lower(name) like '%maya%' then 'Maya'
  when lower(name) like '%credit%' then 'Credit Card'
  when lower(name) like '%debit%' then 'Debit Card'
  when type = 'Cash' then 'Cash'
  when type = 'Bank' then 'Debit Card'
  else 'Other'
end
where expense_payment_method is null;