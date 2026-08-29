-- The fifth alert type: the final word on a gameweek.
--
-- Fired from gameweeks.finished flipping false -> true, which the score
-- function does once every fixture in the week has been played. That is the
-- only moment the week's numbers stop moving, so it is the only honest moment
-- to tell anyone what they were.
create or replace function notify_results()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_top text;
  v_top_points integer;
begin
  if new.finished is not true or old.finished is true then
    return null;
  end if;

  -- Who won the week, and on how much. Ties are reported as the joint total
  -- rather than picking a winner arbitrarily, so nobody is told they lost to
  -- someone they drew with.
  select string_agg(e.display_name, ' & ' order by e.display_name), max(s.points)
    into v_top, v_top_points
  from pick_scores s
  join entrants e on e.id = s.entrant_id
  where s.gameweek = new.id
    and s.points = (select max(points) from pick_scores where gameweek = new.id)
    and s.points > 0;

  insert into notifications (entrant_id, kind, title, body, gameweek, url)
  select a.entrant_id,
         'results',
         'Gameweek ' || new.id || ' is settled',
         coalesce(
           (select 'You scored ' || s.points
                   || case when s.points = 1 then ' point. ' else ' points. ' end
              from pick_scores s
             where s.gameweek = new.id and s.entrant_id = a.entrant_id),
           'You didn''t pick. '
         )
         || case
              when v_top is null then 'Nobody scored.'
              else v_top || ' took the week on ' || v_top_points
                   || case when v_top_points = 1 then ' point.' else ' points.' end
            end,
         new.id,
         '/leaderboard'
  from alert_prefs a
  where a.results;

  return null;
end $$;

create trigger gameweeks_notify_results
  after update on gameweeks
  for each row execute function notify_results();
