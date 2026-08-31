-- A goal took fifteen minutes to reach a phone. Measured, on Isak's goal in
-- gameweek 2: FPL's own lag, then up to ten minutes waiting for the next
-- `score` tick, then up to five more waiting for `notify`. The alert that is
-- supposed to be the reason you keep the app installed arrived after the
-- highlights.
--
-- Both halves are cron schedules, so both are fixed here.

-- 1. Dispatch every minute instead of every five.
--
-- `notify` costs nothing when there is nothing to send — it is one indexed
-- query returning no rows, and it returned exactly that on every run for the
-- last day. Paying that sixty times an hour to save four minutes on the one
-- run that matters is the right way round.
select cron.unschedule('wingback-notify');
select cron.schedule('wingback-notify', '* * * * *', $$select call_edge_function('notify');$$);

-- 2. Poll for goals every three minutes, but only while a match is on.
--
-- The old guard asked "is a gameweek unfinished and past its lock?", which is
-- true from Friday's deadline until Monday night — so FPL was polled every
-- ten minutes for about three and a half days a week, nearly all of it while
-- nothing was being played.
--
-- Asking about *fixtures* instead means the polling happens where the goals
-- are. The arithmetic matters, because CLAUDE.md is explicit that FPL's
-- Fastly layer refuses this project's egress in bursts. Counted over
-- gameweek 2's real fixture list: this schedule fires 321 times, against the
-- 456 the old always-on one made. So it is roughly 30% *fewer* FPL requests
-- per gameweek, and three times fresher during a match — the polling simply
-- moves from the empty days onto the pitch.
--
--   - two minutes of lead, so the first tick lands on kickoff rather than
--     after it;
--   - `not played`, so a finished match stops being polled — `played`, never
--     `finished` alone, for the reason documented in CLAUDE.md;
--   - a tail past the 150-minute mark that lib/live.ts uses as its cap, so
--     full-time stats and a match that overran are both still collected.
--     Anything missed after that is picked up by the daily settle run.
select cron.unschedule('wingback-score-live');
select cron.schedule('wingback-score-live', '*/3 * * * *', $$
  select call_edge_function('score')
  where exists (
    select 1
    from fixtures f
    join gameweeks g on g.id = f.event
    where not g.finished
      and not f.played
      and f.kickoff_time is not null
      and f.kickoff_time <= now() + interval '2 minutes'
      and f.kickoff_time > now() - interval '170 minutes'
  );
$$);
