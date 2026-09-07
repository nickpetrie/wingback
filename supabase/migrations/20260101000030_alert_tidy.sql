-- Three complaints about the alerts, all confirmed against production before
-- anything here was written.
--
--   1. Haaland's gameweek 3 goal produced 25 notification rows for 5 people.
--      `score` writes picks one at a time, so the per-row notify_goal trigger
--      fired once per pick and each firing fanned out to everyone — five
--      identical emails and pushes each, inside one second.
--   2. "Gameweek 3 is settled" was written at 17:30:01 and "Gameweek 4 is
--      open" at 17:30:02. Two mails, one second apart, about one event.
--   3. The subject lines carried no information. "Gameweek 4 is open" does
--      not tell you when the deadline is, which is the only fact that decides
--      whether you act now or later.

-- --------------------------------------------------------------------------
-- Two columns.
-- --------------------------------------------------------------------------

-- A key for "this alert has already been generated". Nullable, because most
-- alerts genuinely cannot collide (a pick is made once, a gameweek settles
-- once) and inventing a key for them would only be ceremony.
alter table notifications add column dedupe_key text;

-- The long form, for email only. `body` stays short because it is also what a
-- push notification and an SMS carry, and a standings table has no business
-- in either. Email is the one channel with room, so it is the one that gets
-- the detail.
alter table notifications add column detail text;

create unique index notifications_dedupe_idx
  on notifications (entrant_id, dedupe_key)
  where dedupe_key is not null;

-- --------------------------------------------------------------------------
-- Small helpers, so the message-building below reads as prose.
-- --------------------------------------------------------------------------

create or replace function ordinal(n integer)
returns text language sql immutable as $$
  select case
    when n % 100 in (11, 12, 13) then n || 'th'
    when n % 10 = 1 then n || 'st'
    when n % 10 = 2 then n || 'nd'
    when n % 10 = 3 then n || 'rd'
    else n || 'th'
  end
$$;

-- A deadline a person can act on: UK local time, because that is where all
-- five of them are and 17:30Z is not a time anybody recognises as half five.
--
-- `remind` formats the same instant in TypeScript for its own subject lines,
-- so the two have to agree character for character or one gameweek ends up
-- with two deadlines. That is why the minutes are dropped on the hour here
-- rather than left as ':00' — matched on the other side, and measured
-- against it.
create or replace function uk_when(ts timestamptz)
returns text language sql stable as $$
  select case
    when to_char(ts at time zone 'Europe/London', 'MI') = '00'
      then to_char(ts at time zone 'Europe/London', 'FMDy FMDD FMMon, FMHH12am')
    else to_char(ts at time zone 'Europe/London', 'FMDy FMDD FMMon, FMHH12:MIam')
  end
$$;

-- "Nick, Tom and Casra" rather than "Nick, Tom, Casra". The regexp replaces
-- only the final separator, which is the one an English sentence spells out.
create or replace function name_list(names text[])
returns text language sql immutable as $$
  select regexp_replace(array_to_string(names, ', '), ', ([^,]*)$', ' and \1')
$$;

-- The table as it stood after a given gameweek, with where everyone was
-- before it. Ordering matches the `leaderboard` view exactly — points, then
-- the gameweeks a scoring pick landed in — because two places disagreeing
-- about who is second is worse than neither existing.
--
-- Deliberately not `security definer`: it reads through `pick_scores`, which
-- is `security_invoker`, so an anon caller gets what RLS gives them and no
-- more. The trigger below is the definer, and that is where the elevation
-- belongs.
create or replace function standings_at(p_gameweek smallint)
returns table (
  entrant_id uuid,
  display_name text,
  points bigint,
  pos integer,
  prev_pos integer
)
language sql stable set search_path = public as $$
  with after as (
    select e.id, e.display_name,
           coalesce(sum(ps.points), 0)::bigint as pts,
           count(*) filter (where ps.goals > 0) as scoring
    from entrants e
    left join pick_scores ps on ps.entrant_id = e.id and ps.gameweek <= p_gameweek
    group by e.id, e.display_name
  ),
  before as (
    select e.id,
           coalesce(sum(ps.points), 0)::bigint as pts,
           count(*) filter (where ps.goals > 0) as scoring
    from entrants e
    left join pick_scores ps on ps.entrant_id = e.id and ps.gameweek < p_gameweek
    group by e.id
  )
  select a.id,
         a.display_name,
         a.pts,
         rank() over (order by a.pts desc, a.scoring desc)::integer,
         rank() over (order by b.pts desc, b.scoring desc)::integer
  from after a
  join before b on b.id = a.id
$$;

-- --------------------------------------------------------------------------
-- One goal, one alert each.
-- --------------------------------------------------------------------------

create or replace function notify_goal()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_player text;
  v_team text;
  v_type smallint;
  v_scored smallint;
  v_holders text;
  v_holder_count integer;
begin
  -- Only a goal going *up*. The score function rewrites every pick in a
  -- gameweek on each run, so most of these updates change nothing, and a
  -- correction downward is not news worth a buzz.
  v_scored := new.goals - old.goals;
  if v_scored <= 0 then
    return null;
  end if;

  select p.web_name, t.short_name, p.element_type
    into v_player, v_team, v_type
  from players p join teams t on t.id = p.team_id
  where p.code = new.player_code;

  -- Everyone on this player this gameweek. The alert says so, which is the
  -- honest version of what five identical alerts were badly trying to convey.
  select name_list(array_agg(e.display_name order by e.display_name)), count(*)
    into v_holders, v_holder_count
  from picks pk
  join entrants e on e.id = pk.entrant_id
  where pk.gameweek = new.gameweek and pk.player_code = new.player_code;

  insert into notifications (entrant_id, kind, title, body, gameweek, dedupe_key)
  select
    a.entrant_id,
    'goal',
    v_player || ' scores'
      || case
           -- Points are per pick, not per goal: the same goal is worth double
           -- to someone who staked £6, so each recipient is told their own
           -- number rather than the triggering row's.
           when mine.stake is not null then
             ' — ' || pick_points(v_type, mine.stake, v_scored)
               || case when pick_points(v_type, mine.stake, v_scored) = 1 then ' pt' else ' pts' end
               || ' for you'
           when v_holder_count = 1 then ' — ' || v_holders || '''s pick'
           else ' — ' || v_holder_count || ' picks on him'
         end,
    v_player || ' (' || v_team || ') has scored.'
      || case
           when mine.stake is not null then
             ' ' || pick_points(v_type, mine.stake, v_scored)
               || case when pick_points(v_type, mine.stake, v_scored) = 1 then ' point' else ' points' end
               || ' for you.'
           else ''
         end
      || case
           when v_holder_count = 2 then ' ' || v_holders || ' are both on him.'
           when v_holder_count > 2 then ' ' || v_holders || ' are all on him.'
           when mine.stake is null then ' ' || v_holders || '''s pick.'
           else ''
         end,
    new.gameweek,
    -- The whole fix for the twenty-five rows. Every pick on this player in
    -- this gameweek arrives at the same key, so whichever row `score` happens
    -- to update first writes the alert and the rest collide and do nothing.
    -- The goal tally is part of the key so a second goal is a second alert.
    'goal:' || new.gameweek || ':' || new.player_code || ':' || new.goals
  from alert_prefs a
  left join picks mine
    on mine.entrant_id = a.entrant_id
   and mine.gameweek = new.gameweek
   and mine.player_code = new.player_code
  where a.goal_alerts  -- including your own: a goal you scored is the news
  on conflict do nothing;

  return null;
end $$;

-- --------------------------------------------------------------------------
-- One message when a gameweek settles, not two.
-- --------------------------------------------------------------------------

create or replace function notify_results()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_top text;
  v_top_points integer;
  v_next_id smallint;
  v_next_lock timestamptz;
  v_next_line text;
  v_table text;
begin
  if new.finished is not true or old.finished is true then
    return null;
  end if;

  -- Who won the week, and on how much. Ties are reported as the joint total
  -- rather than picking a winner arbitrarily, so nobody is told they lost to
  -- someone they drew with.
  select name_list(array_agg(e.display_name order by e.display_name)), max(s.points)
    into v_top, v_top_points
  from pick_scores s
  join entrants e on e.id = s.entrant_id
  where s.gameweek = new.id
    and s.points = (select max(points) from pick_scores where gameweek = new.id)
    and s.points > 0;

  -- The next gameweek opens the instant this one settles, which is why the
  -- reminder used to arrive a second after this alert. It is the same news,
  -- so it is now the same message; `remind` skips its own `open` window for
  -- anyone who receives this.
  select g.id, g.lock_at into v_next_id, v_next_lock
  from gameweeks g
  where g.id > new.id and g.finished = false
  order by g.id
  limit 1;

  -- `lock_at`, not `deadline_time`: the lock is the moment picks_guard stops
  -- accepting a pick, it is what the countdown in the header counts down to,
  -- and it is what `remind` puts in its own subject lines. FPL's deadline is
  -- half an hour earlier, and two different times for one gameweek is how an
  -- alert stops being trusted. Null while a gameweek has no fixtures yet.
  v_next_line := case
    when v_next_id is null then ''
    when v_next_lock is null then 'Gameweek ' || v_next_id || ' is open — no deadline set yet.'
    else 'Gameweek ' || v_next_id || ' is open — deadline ' || uk_when(v_next_lock) || '.'
  end;

  select string_agg(
           lpad(ordinal(s.pos), 3) || '  ' || rpad(s.display_name, 16) || lpad(s.points::text, 3)
             || case
                  when s.prev_pos > s.pos then '   (up ' || (s.prev_pos - s.pos) || ')'
                  when s.prev_pos < s.pos then '   (down ' || (s.pos - s.prev_pos) || ')'
                  else ''
                end,
           E'\n' order by s.pos, s.display_name)
    into v_table
  from standings_at(new.id) s;

  insert into notifications (entrant_id, kind, title, body, detail, gameweek, url, dedupe_key)
  select
    a.entrant_id,
    'results',
    'GW' || new.id || ' settled — '
      || case when st.pos = 1 then 'you''re top' else 'you''re ' || ordinal(st.pos) end
      || case
           when st.prev_pos > st.pos then ', up ' || (st.prev_pos - st.pos)
           when st.prev_pos < st.pos then ', down ' || (st.pos - st.prev_pos)
           else ''
         end,
    -- Short, because this is also what a phone and a text message show.
    -- Assembled without trailing spaces: each clause supplies the space
    -- before it, so an absent next gameweek leaves no dangling blank.
    coalesce(
      (select 'You scored ' || s.points
              || case when s.points = 1 then ' point.' else ' points.' end
         from pick_scores s where s.gameweek = new.id and s.entrant_id = a.entrant_id),
      'You didn''t pick.'
    )
      || case
           when v_top is null then ' Nobody scored.'
           else ' ' || v_top || ' took the week on ' || v_top_points
                || case when v_top_points = 1 then ' point.' else ' points.' end
         end
      || case when v_next_line = '' then '' else ' ' || v_next_line end,
    -- The long form. Only email sees this.
    'Gameweek ' || new.id || ' is settled.' || E'\n\n'
      || coalesce(
           (select 'You scored ' || s.points
                   || case when s.points = 1 then ' point' else ' points' end
                   || ' with ' || pl.web_name || ' (' || t.short_name || ').'
              from pick_scores s
              join players pl on pl.code = s.player_code
              join teams t on t.id = pl.team_id
             where s.gameweek = new.id and s.entrant_id = a.entrant_id),
           'You didn''t pick this week.'
         )
      || E'\n'
      || case
           when v_top is null then 'Nobody scored.'
           else v_top || ' took the week on ' || v_top_points
                || case when v_top_points = 1 then ' point.' else ' points.' end
         end
      || E'\n\nThe table after gameweek ' || new.id || E'\n'
      || coalesce(v_table, '')
      || case when v_next_line = '' then '' else E'\n\n' || v_next_line end,
    new.id,
    '/leaderboard',
    'results:' || new.id
  from alert_prefs a
  join standings_at(new.id) st on st.entrant_id = a.entrant_id
  where a.results
  on conflict do nothing;

  return null;
end $$;

-- --------------------------------------------------------------------------
-- A pick alert worth reading.
-- --------------------------------------------------------------------------

-- "Nick Petrie has picked" told you nothing you'd act on; the player is the
-- point, and it was already in the body. Moving it into the title moves it
-- into the email subject, which is `Wingback: ` + the title.
create or replace function notify_pick_made()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_who text;
  v_player text;
  v_team text;
begin
  select display_name into v_who from entrants where id = new.entrant_id;
  select p.web_name, t.short_name into v_player, v_team
  from players p join teams t on t.id = p.team_id
  where p.code = new.player_code;

  insert into notifications (entrant_id, kind, title, body, gameweek)
  select a.entrant_id,
         'pick_made',
         v_who || ' is on ' || v_player || ' (' || v_team || ') for GW' || new.gameweek,
         v_who || ' is on ' || v_player || ' (' || v_team || ') for gameweek ' || new.gameweek || '.',
         new.gameweek
  from alert_prefs a
  where a.pick_activity
    and a.entrant_id <> new.entrant_id;  -- you know what you picked

  return null;
end $$;
