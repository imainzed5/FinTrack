-- Automatically enable RLS for newly created app tables.

create or replace function public.ensure_rls_on_new_tables()
returns event_trigger
language plpgsql
as $$
declare
  ddl record;
begin
  for ddl in
    select *
    from pg_event_trigger_ddl_commands()
    where command_tag in ('CREATE TABLE', 'CREATE TABLE AS')
      and object_type = 'table'
      and schema_name = 'public'
      and in_extension = false
  loop
    execute format('alter table %s enable row level security', ddl.object_identity);
  end loop;
end;
$$;

drop event trigger if exists ensure_rls;
create event trigger ensure_rls
on ddl_command_end
when tag in ('CREATE TABLE', 'CREATE TABLE AS')
execute function public.ensure_rls_on_new_tables();