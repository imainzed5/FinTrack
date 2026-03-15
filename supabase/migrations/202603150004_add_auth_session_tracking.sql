-- Auth session tracking to power account security settings.

create table if not exists public.user_auth_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  session_token text not null unique check (char_length(session_token) between 20 and 120),
  device_type text not null default 'unknown' check (device_type in ('desktop', 'mobile', 'tablet', 'unknown')),
  device_label text not null default 'Unknown device' check (char_length(device_label) between 1 and 120),
  browser text not null default 'Unknown browser' check (char_length(browser) between 1 and 60),
  os text not null default 'Unknown OS' check (char_length(os) between 1 and 60),
  ip_address text,
  user_agent text,
  signed_in_at timestamptz not null default now(),
  last_active_at timestamptz not null default now(),
  ended_at timestamptz,
  revoked_at timestamptz,
  revoked_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ended_at is null or ended_at >= signed_in_at),
  check (revoked_at is null or revoked_at >= signed_in_at)
);

create index if not exists user_auth_sessions_user_last_active_idx
  on public.user_auth_sessions (user_id, last_active_at desc);

create index if not exists user_auth_sessions_user_signed_in_idx
  on public.user_auth_sessions (user_id, signed_in_at desc);

create index if not exists user_auth_sessions_user_active_idx
  on public.user_auth_sessions (user_id)
  where ended_at is null and revoked_at is null;

drop trigger if exists user_auth_sessions_set_updated_at on public.user_auth_sessions;
create trigger user_auth_sessions_set_updated_at
before update on public.user_auth_sessions
for each row
execute function public.set_updated_at();

alter table public.user_auth_sessions enable row level security;

drop policy if exists user_auth_sessions_select_own on public.user_auth_sessions;
create policy user_auth_sessions_select_own
on public.user_auth_sessions
for select
using (auth.uid() = user_id);

drop policy if exists user_auth_sessions_insert_own on public.user_auth_sessions;
create policy user_auth_sessions_insert_own
on public.user_auth_sessions
for insert
with check (auth.uid() = user_id);

drop policy if exists user_auth_sessions_update_own on public.user_auth_sessions;
create policy user_auth_sessions_update_own
on public.user_auth_sessions
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
