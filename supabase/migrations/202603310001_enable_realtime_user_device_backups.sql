do $$
begin
  alter publication supabase_realtime add table public.user_device_backups;
exception
  when duplicate_object then
    null;
end
$$;