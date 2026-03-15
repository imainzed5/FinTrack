-- Moneda Supabase/PostgreSQL initial schema
-- Generated: 2026-03-15
-- Purpose: Move JSON-based local data model to a normalized, multi-user relational schema.

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Enums (aligned with src/lib/types.ts)
-- -----------------------------------------------------------------------------
create type public.expense_category as enum (
  'Food',
  'Transportation',
  'Subscriptions',
  'Utilities',
  'Shopping',
  'Entertainment',
  'Health',
  'Education',
  'Miscellaneous'
);

create type public.payment_method as enum (
  'Cash',
  'Credit Card',
  'Debit Card',
  'GCash',
  'Maya',
  'Bank Transfer',
  'Other'
);

create type public.recurring_frequency as enum ('daily', 'weekly', 'monthly', 'yearly');

create type public.budget_category as enum (
  'Overall',
  'Food',
  'Transportation',
  'Subscriptions',
  'Utilities',
  'Shopping',
  'Entertainment',
  'Health',
  'Education',
  'Miscellaneous'
);

-- -----------------------------------------------------------------------------
-- Utility triggers/functions
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

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

  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Core identity/settings tables
-- -----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  currency_code text not null default 'PHP',
  timezone text not null default 'Asia/Manila',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(currency_code) = 3)
);

create table public.user_settings (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  theme text not null default 'system' check (theme in ('light', 'dark', 'system')),
  notifications_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Transactions + split allocations
-- -----------------------------------------------------------------------------
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,

  amount numeric(12,2) not null check (amount > 0),
  category public.expense_category not null,
  sub_category text,

  merchant text,
  description text not null,
  transaction_at timestamptz not null default now(),
  payment_method public.payment_method not null default 'Cash',

  notes text not null default '',
  tags text[] not null default '{}',
  attachment_base64 text,
  receipt_path text,

  recurring_frequency public.recurring_frequency,
  recurring_interval integer,
  recurring_next_run_at timestamptz,
  recurring_end_at timestamptz,

  recurring_origin_id uuid references public.transactions (id) on delete set null,
  is_auto_generated boolean not null default false,

  synced boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (
    (
      recurring_frequency is null
      and recurring_interval is null
      and recurring_next_run_at is null
      and recurring_end_at is null
    )
    or
    (
      recurring_frequency is not null
      and recurring_interval is not null
      and recurring_interval >= 1
      and recurring_next_run_at is not null
    )
  )
);

create table public.transaction_splits (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions (id) on delete cascade,
  category public.expense_category not null,
  sub_category text,
  amount numeric(12,2) not null check (amount > 0),
  created_at timestamptz not null default now()
);

create or replace function public.validate_transaction_split_totals(p_transaction_id uuid)
returns void
language plpgsql
as $$
declare
  tx_amount numeric(12,2);
  split_count integer;
  split_total numeric(12,2);
begin
  select t.amount
  into tx_amount
  from public.transactions t
  where t.id = p_transaction_id;

  -- Parent transaction might already be deleted (cascade path).
  if tx_amount is null then
    return;
  end if;

  select count(*), coalesce(sum(ts.amount), 0)
  into split_count, split_total
  from public.transaction_splits ts
  where ts.transaction_id = p_transaction_id;

  if split_count = 0 then
    return;
  end if;

  if split_count < 2 then
    raise exception 'Split transactions require at least 2 lines.';
  end if;

  if abs(split_total - tx_amount) > 0.01 then
    raise exception 'Split line totals (%) must equal transaction amount (%).', split_total, tx_amount;
  end if;
end;
$$;

create or replace function public.enforce_split_totals_on_split_change()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    perform public.validate_transaction_split_totals(old.transaction_id);
    return old;
  end if;

  if tg_op = 'UPDATE' and new.transaction_id <> old.transaction_id then
    perform public.validate_transaction_split_totals(old.transaction_id);
  end if;

  perform public.validate_transaction_split_totals(new.transaction_id);
  return new;
end;
$$;

create or replace function public.enforce_split_totals_on_transaction_change()
returns trigger
language plpgsql
as $$
begin
  perform public.validate_transaction_split_totals(new.id);
  return new;
end;
$$;

create constraint trigger transaction_splits_total_check
after insert or update or delete on public.transaction_splits
deferrable initially deferred
for each row
execute function public.enforce_split_totals_on_split_change();

create constraint trigger transactions_total_check
after update of amount on public.transactions
deferrable initially deferred
for each row
execute function public.enforce_split_totals_on_transaction_change();

-- -----------------------------------------------------------------------------
-- Budgets + threshold alerts
-- -----------------------------------------------------------------------------
create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,

  budget_month date not null,
  category public.budget_category not null default 'Overall',
  sub_category text,
  monthly_limit numeric(12,2) not null check (monthly_limit > 0),
  rollover boolean not null default false,

  -- Kept for direct compatibility with existing app logic.
  alert_thresholds_triggered smallint[] not null default '{}',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (budget_month = date_trunc('month', budget_month)::date),
  check ((category = 'Overall' and sub_category is null) or category <> 'Overall'),
  check (alert_thresholds_triggered <@ array[50,80,100]::smallint[])
);

create unique index budgets_user_month_scope_uniq
on public.budgets (user_id, budget_month, category, coalesce(sub_category, ''));

create table public.budget_threshold_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  budget_id uuid not null references public.budgets (id) on delete cascade,

  budget_month date not null,
  threshold smallint not null check (threshold in (50, 80, 100)),
  spent numeric(12,2) not null check (spent >= 0),
  effective_limit numeric(12,2) not null check (effective_limit > 0),
  percentage numeric(8,4) not null check (percentage >= 0),
  message text not null,

  created_at timestamptz not null default now(),

  check (budget_month = date_trunc('month', budget_month)::date),
  unique (budget_id, budget_month, threshold)
);

-- -----------------------------------------------------------------------------
-- Helpful indexes for current API access patterns
-- -----------------------------------------------------------------------------
create index transactions_user_date_idx
  on public.transactions (user_id, transaction_at desc);

create index transactions_user_category_date_idx
  on public.transactions (user_id, category, transaction_at desc);

create index transactions_user_origin_date_idx
  on public.transactions (user_id, recurring_origin_id, transaction_at desc)
  where recurring_origin_id is not null;

create index transactions_due_recurring_idx
  on public.transactions (user_id, recurring_next_run_at)
  where recurring_frequency is not null and is_auto_generated = false;

create index transactions_tags_gin_idx
  on public.transactions using gin (tags);

create index transaction_splits_transaction_idx
  on public.transaction_splits (transaction_id, created_at, id);

create index budgets_user_month_idx
  on public.budgets (user_id, budget_month desc);

create index budget_threshold_alerts_user_month_idx
  on public.budget_threshold_alerts (user_id, budget_month desc);

-- -----------------------------------------------------------------------------
-- Updated-at triggers
-- -----------------------------------------------------------------------------
create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

create trigger user_settings_set_updated_at
before update on public.user_settings
for each row
execute function public.set_updated_at();

create trigger transactions_set_updated_at
before update on public.transactions
for each row
execute function public.set_updated_at();

create trigger budgets_set_updated_at
before update on public.budgets
for each row
execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Auto-provision profile/settings on auth signup
-- -----------------------------------------------------------------------------
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Row Level Security (Supabase)
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.transactions enable row level security;
alter table public.transaction_splits enable row level security;
alter table public.budgets enable row level security;
alter table public.budget_threshold_alerts enable row level security;

create policy profiles_select_own
on public.profiles
for select
using (auth.uid() = id);

create policy profiles_insert_own
on public.profiles
for insert
with check (auth.uid() = id);

create policy profiles_update_own
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

create policy settings_select_own
on public.user_settings
for select
using (auth.uid() = user_id);

create policy settings_insert_own
on public.user_settings
for insert
with check (auth.uid() = user_id);

create policy settings_update_own
on public.user_settings
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy transactions_select_own
on public.transactions
for select
using (auth.uid() = user_id);

create policy transactions_insert_own
on public.transactions
for insert
with check (auth.uid() = user_id);

create policy transactions_update_own
on public.transactions
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy transactions_delete_own
on public.transactions
for delete
using (auth.uid() = user_id);

create policy transaction_splits_select_own
on public.transaction_splits
for select
using (
  exists (
    select 1
    from public.transactions t
    where t.id = transaction_splits.transaction_id
      and t.user_id = auth.uid()
  )
);

create policy transaction_splits_insert_own
on public.transaction_splits
for insert
with check (
  exists (
    select 1
    from public.transactions t
    where t.id = transaction_splits.transaction_id
      and t.user_id = auth.uid()
  )
);

create policy transaction_splits_update_own
on public.transaction_splits
for update
using (
  exists (
    select 1
    from public.transactions t
    where t.id = transaction_splits.transaction_id
      and t.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.transactions t
    where t.id = transaction_splits.transaction_id
      and t.user_id = auth.uid()
  )
);

create policy transaction_splits_delete_own
on public.transaction_splits
for delete
using (
  exists (
    select 1
    from public.transactions t
    where t.id = transaction_splits.transaction_id
      and t.user_id = auth.uid()
  )
);

create policy budgets_select_own
on public.budgets
for select
using (auth.uid() = user_id);

create policy budgets_insert_own
on public.budgets
for insert
with check (auth.uid() = user_id);

create policy budgets_update_own
on public.budgets
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy budgets_delete_own
on public.budgets
for delete
using (auth.uid() = user_id);

create policy budget_alerts_select_own
on public.budget_threshold_alerts
for select
using (auth.uid() = user_id);

create policy budget_alerts_insert_own
on public.budget_threshold_alerts
for insert
with check (auth.uid() = user_id);

create policy budget_alerts_update_own
on public.budget_threshold_alerts
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy budget_alerts_delete_own
on public.budget_threshold_alerts
for delete
using (auth.uid() = user_id);
