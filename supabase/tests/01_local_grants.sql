-- Mirrors Supabase's default grants (broad table privileges, restricted by
-- RLS policies) so the harness behaves like the real platform.

grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on all tables in schema public to anon;
grant usage, select on all sequences in schema public to authenticated;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
