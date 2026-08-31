-- A finished gameweek stays finished.
--
-- `score` marks a gameweek done on `finished or finished_provisional`,
-- because FPL's own `finished` lags full time by days — measured again on
-- gameweek 2, where all ten fixtures still read `finished: false` on the
-- Monday while nine were `finished_provisional`. That is the trap CLAUDE.md
-- already documents one level down, at the fixture.
--
-- `sync-fpl` was upserting `finished` from the same lagging source once an
-- hour, and a PostgREST upsert SETs every column it lists — so the hourly run
-- reverted whatever `score` had decided, for as long as FPL disagreed.
--
-- The visible cost was not a wrong flag. `remind` takes the current gameweek
-- to be the earliest unfinished one; with a settled gameweek reset to
-- unfinished it selects that one, finds the deadline long past, and returns
-- without sending. Nobody gets a pick reminder for the gameweek that is
-- actually open — which is the thing this app was built to fix.
--
-- The function no longer writes the column (see sync-fpl/index.ts), but the
-- guard lives here rather than only there for the same reason picks_guard
-- does: the rule should hold whatever any caller does. Nothing legitimately
-- un-finishes a gameweek today — `score` only ever writes true.
create or replace function gameweeks_finished_latch()
returns trigger language plpgsql as $$
begin
  if old.finished and not new.finished then
    new.finished := true;
  end if;
  return new;
end $$;

create trigger gameweeks_keep_finished
  before update on gameweeks
  for each row execute function gameweeks_finished_latch();
