-- What else happened to your player.
--
-- The app tells you when a pick scores and says nothing otherwise, so a
-- gameweek where someone's striker was sent off in the twentieth minute reads
-- exactly like one where he had a quiet game. That is the more interesting of
-- the two, and the group chat finds out from the telly rather than from here.
--
-- Same shape as goals throughout: the columns live on the pick, the score
-- function is the only thing that writes them, and a trigger turns an increase
-- into a notification. Deliberately *not* part of the scoring — pick_points()
-- is untouched, an own goal costs nothing, and nothing here can move the
-- table. This is commentary.

alter table picks
  add column red_cards smallint not null default 0,
  add column own_goals smallint not null default 0;

-- The same door goals are locked behind. The picks update policy lets an
-- entrant touch their own row to change player or stake, and without this they
-- could send themselves through it — or, more likely, quietly un-send-off
-- their own player.
create or replace function picks_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_lock_at timestamptz;
  v_choice_changed boolean;
  v_player_changed boolean;
  v_nomination integer;
  v_limit smallint;
  v_count smallint;
  v_sub_count smallint;
  rec record;
begin
  -- Goals, cards and own goals are written only by the score edge function
  -- (service role, which bypasses RLS).
  if auth.role() is distinct from 'service_role' then
    if tg_op = 'UPDATE' and (new.goals is distinct from old.goals
                          or new.red_cards is distinct from old.red_cards
                          or new.own_goals is distinct from old.own_goals) then
      raise exception 'goals are set by the results sync, not by entrants'
        using errcode = 'P0001';
    end if;
    if tg_op = 'INSERT' and (new.goals is distinct from 0
                          or new.red_cards is distinct from 0
                          or new.own_goals is distinct from 0) then
      raise exception 'goals are set by the results sync, not by entrants'
        using errcode = 'P0001';
    end if;
  end if;

  select lock_at into v_lock_at from gameweeks where id = new.gameweek;

  if tg_op = 'INSERT' then
    v_choice_changed := true;
    v_player_changed := true;
  else
    v_choice_changed := (new.player_code is distinct from old.player_code)
                      or (new.stake is distinct from old.stake);
    v_player_changed := (new.player_code is distinct from old.player_code);
  end if;

  if v_choice_changed and not new.is_substitution then
    if v_lock_at is null or now() >= v_lock_at then
      raise exception 'gameweek % is locked', new.gameweek
        using errcode = 'P0001';
    end if;
  end if;

  if v_player_changed then
    if new.is_substitution then
      if tg_op <> 'UPDATE' then
        raise exception 'a free substitution must be an update to an existing pick'
          using errcode = 'P0001';
      end if;
      if old.fixture_id is null or new.fixture_id is distinct from old.fixture_id then
        raise exception 'a free substitution must stay within the same fixture'
          using errcode = 'P0001';
      end if;

      select count(*) into v_sub_count
      from picks
      where entrant_id = new.entrant_id and is_substitution and id <> new.id;

      if v_sub_count >= 2 then
        raise exception 'free substitution limit (2 per season) already used'
          using errcode = 'P0001';
      end if;

      new.substituted_from_player_code := old.player_code;
    end if;

    select nomination_player_code into v_nomination
    from entrants where id = new.entrant_id;

    v_limit := case when v_nomination is not distinct from null then 1
                    when new.player_code = v_nomination then 2
                    else 1 end;

    v_count := 0;
    for rec in
      select goals from picks
      where entrant_id = new.entrant_id
        and player_code = new.player_code
        and id <> new.id
      order by gameweek
    loop
      v_count := v_count + 1;
      if rec.goals >= 3 then
        v_count := 0;
      end if;
    end loop;

    if v_count >= v_limit then
      raise exception 'player % is not available for this entrant this season', new.player_code
        using errcode = 'P0001';
    end if;
  end if;

  new.updated_at := now();
  return new;
end $$;

alter table notifications drop constraint notifications_kind_check;
alter table notifications add constraint notifications_kind_check
  check (kind in ('pick_reminder', 'pick_made', 'goal', 'injury', 'results', 'red_card', 'own_goal'));

-- One alert per event per person, by the same mechanism as a goal: `score`
-- writes picks one at a time, so five people on the same player would
-- otherwise get five copies each.
create or replace function notify_card()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_player text;
  v_team text;
  v_holders text;
  v_holder_count integer;
begin
  if new.red_cards <= old.red_cards and new.own_goals <= old.own_goals then
    return null;
  end if;

  select p.web_name, t.short_name into v_player, v_team
  from players p join teams t on t.id = p.team_id
  where p.code = new.player_code;

  select name_list(array_agg(e.display_name order by e.display_name)), count(*)
    into v_holders, v_holder_count
  from picks pk
  join entrants e on e.id = pk.entrant_id
  where pk.gameweek = new.gameweek and pk.player_code = new.player_code;

  if new.red_cards > old.red_cards then
    insert into notifications (entrant_id, kind, title, body, gameweek, dedupe_key)
    select
      a.entrant_id,
      'red_card',
      v_player || ' sent off'
        || case
             when mine.id is not null then ' — that''s your pick'
             when v_holder_count = 1 then ' — ' || v_holders || '''s pick'
             else ' — ' || v_holder_count || ' picks on him'
           end,
      v_player || ' (' || v_team || ') has been sent off.'
        || case
             when v_holder_count = 1 and mine.id is not null then ' He is done for the day, and so are you.'
             when v_holder_count > 1 then ' ' || v_holders || ' are on him.'
             else ' ' || v_holders || ' is on him.'
           end,
      new.gameweek,
      'red:' || new.gameweek || ':' || new.player_code || ':' || new.red_cards
    from alert_prefs a
    left join picks mine
      on mine.entrant_id = a.entrant_id
     and mine.gameweek = new.gameweek
     and mine.player_code = new.player_code
    where a.goal_alerts
    on conflict do nothing;
  end if;

  if new.own_goals > old.own_goals then
    insert into notifications (entrant_id, kind, title, body, gameweek, dedupe_key)
    select
      a.entrant_id,
      'own_goal',
      v_player || ' scores an own goal'
        || case
             when mine.id is not null then ' — that''s your pick'
             when v_holder_count = 1 then ' — ' || v_holders || '''s pick'
             else ' — ' || v_holder_count || ' picks on him'
           end,
      -- Said plainly, because the first thing anyone wants to know is whether
      -- it counts. It does not: pick_points() only ever reads `goals`.
      v_player || ' (' || v_team || ') has put one in his own net. It doesn''t count against anyone — '
        || case
             when mine.id is not null then 'it just isn''t the end you wanted.'
             else 'it just isn''t the end ' || v_holders || ' wanted.'
           end,
      new.gameweek,
      'og:' || new.gameweek || ':' || new.player_code || ':' || new.own_goals
    from alert_prefs a
    left join picks mine
      on mine.entrant_id = a.entrant_id
     and mine.gameweek = new.gameweek
     and mine.player_code = new.player_code
    where a.goal_alerts
    on conflict do nothing;
  end if;

  return null;
end $$;

create trigger picks_notify_card
  after update on picks
  for each row execute function notify_card();
