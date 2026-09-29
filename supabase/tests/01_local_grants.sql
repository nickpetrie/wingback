-- Mirrors Supabase's default grants (broad table privileges, restricted by
-- RLS policies) so the harness behaves like the real platform.
--
-- Stated as default privileges and applied *before* the migrations, because
-- that is how Supabase does it: every table gets the broad grant at creation,
-- and a later migration can narrow it. 20260101000032 revokes the table-level
-- SELECT on entrants and grants back everything but the contact columns — a
-- blanket `grant select on all tables` run after the migrations would quietly
-- hand those columns back and the test pinning them would pass for the wrong
-- reason.

alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant select on tables to anon;
alter default privileges in schema public grant usage, select on sequences to authenticated;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
