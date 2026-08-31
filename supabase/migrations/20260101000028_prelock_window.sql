-- Widen the pre-deadline ramp from two hours to five.
--
-- The shape of the polling ladder is unchanged and deliberate:
--
--   between gameweeks   sync-fpl hourly              24 calls a day
--   5h before lock      sync-fpl every 10 minutes    30 calls a gameweek
--   match window        score every 3 minutes        321 calls a gameweek
--
-- Only the middle rung moves. Two hours turned out to be tight for the thing
-- that rung exists for — late team news, and the fixture changes that shift a
-- deadline — because a manager's Friday press conference lands well before
-- the two-hour mark, and until sync-fpl runs the picker is showing yesterday's
-- injury flags to someone choosing a player.
--
-- Five hours at ten minutes is 30 invocations a gameweek against the 12 the
-- two-hour window made. Cheap, and small enough not to matter to the Fastly
-- behaviour CLAUDE.md documents — unlike widening this to the 48 hours first
-- considered, which would have been 288.
select cron.unschedule('wingback-sync-prelock');
select cron.schedule('wingback-sync-prelock', '*/10 * * * *', $$
  select call_edge_function('sync-fpl')
  where exists (
    select 1 from gameweeks
    where lock_at is not null
      and lock_at > now()
      and lock_at <= now() + interval '5 hours'
  );
$$);
