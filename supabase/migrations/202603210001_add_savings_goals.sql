-- savings_goals table
create table public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  emoji text not null default '🎯',
  color_accent text not null default '#1D9E75',
  tag text,
  motivation_note text,
  target_amount numeric(12,2) not null,
  current_amount numeric(12,2) not null default 0,
  deadline date,
  is_private boolean not null default false,
  is_pinned boolean not null default false,
  sort_order integer not null default 0,
  status text not null default 'active' check (status in ('active', 'completed', 'archived')),
  completed_at timestamptz,
  what_did_you_buy text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- savings_deposits table
create table public.savings_deposits (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.savings_goals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(12,2) not null,
  type text not null default 'deposit' check (type in ('deposit', 'withdrawal')),
  note text,
  created_at timestamptz not null default now()
);

-- RLS
alter table public.savings_goals enable row level security;
alter table public.savings_deposits enable row level security;

create policy "Users can manage their own goals"
  on public.savings_goals for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can manage their own deposits"
  on public.savings_deposits for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Auto-update updated_at on savings_goals
create or replace function update_savings_goals_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger savings_goals_updated_at
  before update on public.savings_goals
  for each row execute function update_savings_goals_updated_at();
