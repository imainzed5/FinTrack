-- Policy consent audit logging and re-consent support.

create table if not exists public.user_consent_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  policy_type text not null check (policy_type in ('terms_of_service', 'privacy_policy')),
  version text not null check (char_length(version) between 1 and 20),
  accepted_at timestamptz not null default now(),
  ip_address inet,
  user_agent text,
  source text not null default 'unknown' check (char_length(source) between 1 and 50),
  created_at timestamptz not null default now()
);

create index if not exists user_consent_log_user_id_idx
  on public.user_consent_log (user_id, accepted_at desc);

create index if not exists user_consent_log_policy_type_idx
  on public.user_consent_log (policy_type, accepted_at desc);

create unique index if not exists user_consent_log_user_policy_version_source_uniq
  on public.user_consent_log (user_id, policy_type, version, source);

alter table public.user_consent_log enable row level security;

drop policy if exists consent_log_select_own on public.user_consent_log;
create policy consent_log_select_own
on public.user_consent_log
for select
using (auth.uid() = user_id);

drop policy if exists consent_log_insert_own on public.user_consent_log;
create policy consent_log_insert_own
on public.user_consent_log
for insert
with check (auth.uid() = user_id);

create or replace function public.try_parse_timestamptz(p_value text)
returns timestamptz
language plpgsql
as $$
begin
  if p_value is null or btrim(p_value) = '' then
    return null;
  end if;

  return p_value::timestamptz;
exception
  when others then
    return null;
end;
$$;

create or replace function public.capture_signup_consent()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  metadata jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  terms_version text := nullif(trim(metadata ->> 'terms_version'), '');
  privacy_version text := nullif(trim(metadata ->> 'privacy_version'), '');
  terms_accepted_at timestamptz := coalesce(
    public.try_parse_timestamptz(metadata ->> 'accepted_terms_at'),
    now()
  );
  privacy_accepted_at timestamptz := coalesce(
    public.try_parse_timestamptz(metadata ->> 'accepted_privacy_at'),
    now()
  );
begin
  if terms_version is not null then
    insert into public.user_consent_log (
      user_id,
      policy_type,
      version,
      accepted_at,
      source
    )
    values (
      new.id,
      'terms_of_service',
      terms_version,
      terms_accepted_at,
      'signup'
    )
    on conflict (user_id, policy_type, version, source)
    do update set accepted_at = excluded.accepted_at;
  end if;

  if privacy_version is not null then
    insert into public.user_consent_log (
      user_id,
      policy_type,
      version,
      accepted_at,
      source
    )
    values (
      new.id,
      'privacy_policy',
      privacy_version,
      privacy_accepted_at,
      'signup'
    )
    on conflict (user_id, policy_type, version, source)
    do update set accepted_at = excluded.accepted_at;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_capture_consent on auth.users;
create trigger on_auth_user_created_capture_consent
after insert on auth.users
for each row
execute function public.capture_signup_consent();

insert into public.user_consent_log (
  user_id,
  policy_type,
  version,
  accepted_at,
  source
)
select
  u.id,
  'terms_of_service',
  nullif(trim(u.raw_user_meta_data ->> 'terms_version'), ''),
  coalesce(
    public.try_parse_timestamptz(u.raw_user_meta_data ->> 'accepted_terms_at'),
    u.created_at,
    now()
  ),
  'signup_backfill'
from auth.users u
where nullif(trim(u.raw_user_meta_data ->> 'terms_version'), '') is not null
on conflict (user_id, policy_type, version, source)
do update set accepted_at = excluded.accepted_at;

insert into public.user_consent_log (
  user_id,
  policy_type,
  version,
  accepted_at,
  source
)
select
  u.id,
  'privacy_policy',
  nullif(trim(u.raw_user_meta_data ->> 'privacy_version'), ''),
  coalesce(
    public.try_parse_timestamptz(u.raw_user_meta_data ->> 'accepted_privacy_at'),
    u.created_at,
    now()
  ),
  'signup_backfill'
from auth.users u
where nullif(trim(u.raw_user_meta_data ->> 'privacy_version'), '') is not null
on conflict (user_id, policy_type, version, source)
do update set accepted_at = excluded.accepted_at;
