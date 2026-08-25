-- FPL does not flip `finished` at full time. Measured on this project: every
-- one of GW1's ten fixtures still read `finished: false` three days after
-- kickoff, while the same payload carried `finished_provisional: true` and
-- `minutes: 90`. Reading `finished` alone therefore means a match is never
-- "done" as far as this app is concerned, which quietly broke four things:
-- the leaderboard showed every pick as pending forever, the home fixture list
-- never said "Finished", the trailing-blank-streak note skipped every
-- gameweek, and — worst — the double-gameweek penalty in pick_scores counts
-- goalless fixtures `where f.finished`, so a scoring rule from the brief could
-- never fire at all.
--
-- These three columns are already in the /fixtures/ payload we download and
-- throw away, so recording them costs no extra API call.
alter table fixtures
  add column finished_provisional boolean not null default false,
  add column started boolean not null default false,
  add column minutes smallint not null default 0;

-- Generated, so there is one answer to "has this match been played" and no
-- caller can forget the second half of the condition. Boolean OR is immutable,
-- so unlike lock_at's timestamptz arithmetic this one is fine as generated.
alter table fixtures
  add column played boolean generated always as (finished or finished_provisional) stored;

-- Same view, with the goalless-fixture count reading `played` instead of
-- `finished`. security_invoker is re-stated deliberately: dropping it would
-- let an anon request read every pick straight through the view.
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
    and f.played
    and (f.team_h = pl.team_id or f.team_a = pl.team_id)
    and coalesce(fg.goals, 0) = 0
) gl on true;
