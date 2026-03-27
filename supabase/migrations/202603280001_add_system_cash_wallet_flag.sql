alter table public.accounts
  add column if not exists is_system_cash_wallet boolean not null default false;

update public.accounts
set is_system_cash_wallet = false
where is_system_cash_wallet is distinct from false;

with ranked_cash_wallets as (
  select
    a.id,
    row_number() over (
      partition by a.user_id
      order by
        case when a.name = 'Cash' and a.type = 'Cash' then 0 else 1 end,
        case when a.type = 'Cash' then 0 else 1 end,
        a.created_at asc
    ) as wallet_rank
  from public.accounts a
  where a.is_archived = false
)
update public.accounts a
set is_system_cash_wallet = true
from ranked_cash_wallets ranked
where a.id = ranked.id
  and ranked.wallet_rank = 1;

insert into public.accounts (user_id, name, type, initial_balance, is_archived, is_system_cash_wallet)
select p.id, 'Cash', 'Cash', 0, false, true
from public.profiles p
where not exists (
  select 1
  from public.accounts a
  where a.user_id = p.id
    and a.is_archived = false
    and a.is_system_cash_wallet = true
);

create unique index if not exists accounts_one_active_system_cash_wallet_per_user_idx
  on public.accounts (user_id)
  where is_system_cash_wallet = true and is_archived = false;

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

  insert into public.accounts (user_id, name, type, initial_balance, is_system_cash_wallet)
  values (new.id, 'Cash', 'Cash', 0, true)
  on conflict do nothing;

  return new;
end;
$$;
