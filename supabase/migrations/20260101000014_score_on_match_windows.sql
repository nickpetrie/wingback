-- The live-score job used to fire whenever a gameweek was merely *unfinished*,
-- which is a far longer state than "a match is on". GW1 locked Fri 18:00 and
-- was still unfinished on Monday evening, so `score` ran every 10 minutes for
-- 74 hours — ~450 runs, ~900 FPL calls — for about 14 hours of actual football.
-- Roughly four in five of those runs polled a live-scores endpoint overnight,
-- with no ball being kicked.
--
-- Fire on the fixtures instead: a 4-hour window from each kickoff covers the
-- ~2h match plus the couple of hours in which FPL settles bonus points and
-- reassigns the odd own goal. Anything later than that (a VAR change days on)
-- is what the daily settle run at 03:30 already exists for, so nothing is
-- lost by going quiet in between.
--
-- Note this does NOT reduce the 403s from FPL: those come from Fastly blocking
-- Supabase's shared egress IP in bursts, which has nothing to do with our
-- request volume. It just stops us asking when there is nothing to ask about.

select cron.unschedule(jobid) from cron.job where jobname = 'wingback-score-live';

select cron.schedule('wingback-score-live', '*/10 * * * *', $$
  select call_edge_function('score')
  where exists (
    select 1
    from fixtures f
    join gameweeks g on g.id = f.event
    where not g.finished
      and f.kickoff_time is not null
      and f.kickoff_time <= now()
      and f.kickoff_time > now() - interval '4 hours'
  );
$$);
