-- Per-pick points, including the double-gameweek penalty:
--   - Two doubles per season are free (ranked by gameweek, per entrant).
--   - From the third double onwards, -2 points per goalless fixture that
--     player's team played that gameweek (so -4 is possible in a genuine
--     double gameweek where both fixtures blanked).
-- security_invoker: without it, a view runs with its *owner's* privileges,
-- which quietly bypasses the picks RLS policy above and would leak a
-- rival's still-secret player_code/stake through this view. With it, the
-- view runs as the querying user, so the same lock-based visibility applies.
create or replace view pick_scores with (security_invoker = true) as
select
  p.id as pick_id,
  p.entrant_id,
  p.gameweek,
  p.player_code,
  p.stake,
  p.goals,
  pick_points(pl.element_type, p.stake, p.goals) as base_points,
  case
    when p.stake = 6 and dr.double_rank > 2
      then -2 * coalesce(gl.goalless_fixtures, 0)
    else 0
  end as double_penalty,
  pick_points(pl.element_type, p.stake, p.goals)
    + case
        when p.stake = 6 and dr.double_rank > 2
          then -2 * coalesce(gl.goalless_fixtures, 0)
        else 0
      end as points
from picks p
join players pl on pl.code = p.player_code
left join (
  select id, row_number() over (partition by entrant_id order by gameweek) as double_rank
  from picks
  where stake = 6
) dr on dr.id = p.id
left join lateral (
  select count(*)::integer as goalless_fixtures
  from fixtures f
  left join fixture_goals fg on fg.fixture_id = f.id and fg.player_code = p.player_code
  where f.event = p.gameweek
    and f.finished
    and (f.team_h = pl.team_id or f.team_a = pl.team_id)
    and coalesce(fg.goals, 0) = 0
) gl on true;

-- Double gameweeks: a team appearing twice in one gameweek's fixtures.
-- These are the highest-value weeks in the game, so the album/pick screen
-- surface them straight from this view rather than re-deriving the logic.
create or replace view double_gameweek_teams as
select event, team, count(*) as fixture_count
from (
  select event, team_h as team from fixtures where event is not null
  union all
  select event, team_a as team from fixtures where event is not null
) t
group by event, team
having count(*) > 1;

-- Live leaderboard: all five, computed straight from the DB.
-- Tiebreak is the count of gameweeks in which a scoring pick landed.
create or replace view leaderboard with (security_invoker = true) as
select
  e.id as entrant_id,
  e.display_name,
  coalesce(sum(ps.points), 0)::bigint as total_points,
  count(*) filter (where ps.goals > 0) as scoring_gameweeks
from entrants e
left join pick_scores ps on ps.entrant_id = e.id
group by e.id, e.display_name
order by total_points desc, scoring_gameweeks desc;
