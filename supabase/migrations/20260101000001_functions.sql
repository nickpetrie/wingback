-- Points are never stored: derive them so the UI cannot disagree with the rules.
create or replace function pick_points(element_type integer, stake integer, goals integer)
returns integer language sql immutable as $$
  select coalesce(goals, 0)
       * (case when element_type = 2 then 2 else 1 end)
       * (case when stake = 6 then 2 else 1 end);
$$;

-- lock_at can't be a generated column (timestamptz arithmetic on an
-- aggregate is stable, not immutable), so it's a plain column kept in sync
-- by this trigger whenever a gameweek's fixtures change.
create or replace function recompute_gameweek_lock_at()
returns trigger language plpgsql as $$
declare
  v_event smallint;
begin
  for v_event in
    select distinct e from (
      select new.event as e where tg_op in ('INSERT', 'UPDATE') and new.event is not null
      union
      select old.event as e where tg_op in ('UPDATE', 'DELETE') and old.event is not null
    ) s
  loop
    update gameweeks g
    set lock_at = (
      select min(f.kickoff_time) - interval '1 hour'
      from fixtures f
      where f.event = v_event and f.kickoff_time is not null
    )
    where g.id = v_event;
  end loop;
  return null;
end;
$$;

create trigger fixtures_recompute_lock
after insert or update or delete on fixtures
for each row execute function recompute_gameweek_lock_at();

-- The pick guard has two independent conditions:
--   1. LOCK: a *choice* change (player or stake) is rejected once the
--      gameweek has locked, unless it's a free substitution.
--   2. REUSE: a *player* change must respect the once-per-season limit
--      (twice for the nominated player), with the counter reset to zero
--      every time that player has scored a hat-trick for this entrant.
-- Recording goals (an UPDATE that touches neither player nor stake) trips
-- neither condition.
create or replace function picks_guard()
returns trigger language plpgsql as $$
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
  -- Goals are written only by the score edge function (service role, which
  -- bypasses RLS). The picks update policy lets an entrant touch their own
  -- row for player/stake changes, so block them from smuggling in a goals
  -- edit through that same door.
  if auth.role() is distinct from 'service_role' then
    if tg_op = 'UPDATE' and new.goals is distinct from old.goals then
      raise exception 'goals are set by the results sync, not by entrants'
        using errcode = 'P0001';
    end if;
    if tg_op = 'INSERT' and new.goals is distinct from 0 then
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
end;
$$;

create trigger picks_guard_trigger
before insert or update on picks
for each row execute function picks_guard();

-- Create the entrant row automatically on first sign-in, otherwise there's
-- a chicken-and-egg problem at setup (five magic-link sign-ins, zero entrant
-- rows to attach picks to).
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into entrants (id, email, display_name)
  values (new.id, new.email, split_part(coalesce(new.email, 'entrant'), '@', 1))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function handle_new_user();
