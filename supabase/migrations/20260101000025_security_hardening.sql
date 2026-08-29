-- Recovered from the live database, where it had been applied directly and
-- never written down.
--
-- Two migrations existed only in Supabase's ledger with no file in this repo:
-- `security_hardening` (this one) and `rls_perf`. Rebuilding the project from
-- the repo would have silently dropped both — including the search_path
-- pinning below, which is a privilege-escalation fix, not a nicety.
--
-- `rls_perf` is deliberately *not* recovered. It rewrote the picks, entrants
-- and reminders policies to wrap auth.uid() in a scalar subquery, and every
-- one of those policies was later replaced by 20260101000006 and
-- 20260101000009 — which kept the subquery form. Replaying it here would drag
-- those policies back to auth.uid() and break profile claiming. It is
-- history, and belongs in the ledger rather than in a file.
--
-- This one is idempotent, so it is safe both as a replay against the live
-- database and as a fresh step in a rebuild.

-- A mutable search_path on a SECURITY DEFINER or trigger function is a
-- classic privilege-escalation vector: a crafted search_path can shadow an
-- unqualified table or function reference. All three only ever touch public
-- schema objects, so pinning it there is enough and needs no rewriting.
alter function pick_points(integer, integer, integer) set search_path = public;
alter function recompute_gameweek_lock_at() set search_path = public;
alter function picks_guard() set search_path = public;

-- Same security_invoker reasoning as pick_scores and leaderboard: without it
-- the view runs as its owner rather than the querying user. This one doesn't
-- touch picks so there's no secrecy leak today, but leaving one view as the
-- exception is how the next one gets forgotten.
create or replace view double_gameweek_teams with (security_invoker = true) as
select event, team, count(*) as fixture_count
from (
  select event, team_h as team from fixtures where event is not null
  union all
  select event, team_a as team from fixtures where event is not null
) t
group by event, team
having count(*) > 1;

-- Postgres grants EXECUTE on a new function to PUBLIC by default, which made
-- call_edge_function callable over PostgREST RPC by anyone, signed in or not
-- — i.e. anyone could fire a service-role-authenticated edge function through
-- pg_net. Only pg_cron needs it, and pg_cron runs as postgres, which bypasses
-- grants entirely.
do $$
begin
  -- Guarded because call_edge_function is created by 20260101000004, which is
  -- skipped on a plain Postgres (it needs pg_cron, pg_net and Vault).
  if to_regprocedure('call_edge_function(text, jsonb)') is not null then
    revoke execute on function call_edge_function(text, jsonb) from public, anon, authenticated;
  end if;
  -- handle_new_user was dropped by 20260101000006, so this only bites on a
  -- database that still predates profile claiming.
  if to_regprocedure('handle_new_user()') is not null then
    revoke execute on function handle_new_user() from public, anon, authenticated;
  end if;
end $$;
