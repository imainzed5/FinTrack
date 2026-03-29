create table if not exists public.user_device_backups (
  user_id uuid primary key references auth.users(id) on delete cascade,
  snapshot jsonb not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.user_device_backups enable row level security;

drop policy if exists "user_device_backups_select_own" on public.user_device_backups;
create policy "user_device_backups_select_own"
on public.user_device_backups
for select
using (auth.uid() = user_id);

drop policy if exists "user_device_backups_insert_own" on public.user_device_backups;
create policy "user_device_backups_insert_own"
on public.user_device_backups
for insert
with check (auth.uid() = user_id);

drop policy if exists "user_device_backups_update_own" on public.user_device_backups;
create policy "user_device_backups_update_own"
on public.user_device_backups
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "user_device_backups_delete_own" on public.user_device_backups;
create policy "user_device_backups_delete_own"
on public.user_device_backups
for delete
using (auth.uid() = user_id);

create or replace function public.touch_user_device_backups_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_touch_user_device_backups_updated_at on public.user_device_backups;
create trigger trg_touch_user_device_backups_updated_at
before update on public.user_device_backups
for each row
execute function public.touch_user_device_backups_updated_at();