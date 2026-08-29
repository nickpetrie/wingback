-- Supabase provisions the supabase_realtime publication as part of the
-- platform; a plain local Postgres has no such thing, so the migrations that
-- publish a table to it would fail here. Stand one in.
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;
