-- Four holes from a review of what an entrant's own session can do through
-- PostgREST, none of them reachable from the app's screens. Each is closed in
-- the database, because the app's own code is not the thing being trusted.

-- --------------------------------------------------------------------------
-- 1. The free substitution was a wider door than intended.
-- --------------------------------------------------------------------------
-- The lock exemption keyed off `is_substitution` alone, so after lock a PATCH
-- of {stake: 6, is_substitution: true} doubled the stake without changing the
-- player — the substitution block only runs on a player change, so nothing
-- looked at it. A real substitution never checked that its fixture belonged to
-- the gameweek, had yet to kick off, or that the new player was in it. And
-- flipping `is_substitution` back to false afterwards reset the season count.
--
-- A substitution is now exactly one thing: a player swap, at the same stake,
-- within the pick's own fixture, before that fixture kicks off, for a player
-- who is playing in it, at most once per pick and twice per season. Anything
-- else after lock is just a locked pick. The two-independent-conditions
-- invariant stands: a goals/cards write by the results sync touches neither
-- player nor stake and trips nothing here.
create or replace function picks_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_entrant_write boolean;
  v_lock_at timestamptz;
  v_locked boolean;
  v_player_changed boolean;
  v_stake_changed boolean;
  v_substituting boolean;
  v_fixture fixtures%rowtype;
  v_team smallint;
  v_nomination integer;
  v_limit smallint;
  v_count smallint;
  v_sub_count smallint;
  rec record;
begin
  -- Everything that is not the results sync is an entrant as far as the rules
  -- are concerned, the SQL editor included.
  v_entrant_write := auth.role() is distinct from 'service_role';

  if v_entrant_write then
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
  v_locked := v_lock_at is null or now() >= v_lock_at;

  if tg_op = 'INSERT' then
    v_player_changed := true;
    v_stake_changed := true;
  else
    v_player_changed := new.player_code is distinct from old.player_code;
    v_stake_changed := new.stake is distinct from old.stake;
  end if;

  -- The only shape the lock lets through: the player moves, the stake does
  -- not. An insert flagged as a substitution falls through to the lock check
  -- and is refused below either way.
  v_substituting := new.is_substitution
                and tg_op = 'UPDATE'
                and v_player_changed
                and not v_stake_changed;

  if (v_player_changed or v_stake_changed) and not v_substituting and v_locked then
    raise exception 'gameweek % is locked', new.gameweek
      using errcode = 'P0001';
  end if;

  if v_entrant_write and tg_op = 'UPDATE' then
    -- A substitution that has been made stays made: un-flagging it is what
    -- handed the season's count back.
    if v_locked and old.is_substitution and not new.is_substitution then
      raise exception 'a free substitution cannot be handed back once gameweek % has locked', new.gameweek
        using errcode = 'P0001';
    end if;
    if v_locked and new.fixture_id is distinct from old.fixture_id then
      raise exception 'gameweek % is locked', new.gameweek
        using errcode = 'P0001';
    end if;
    -- Flagging a pick as substituted without swapping anyone is a used
    -- substitution with no substitute, and the app never sends it.
    if new.is_substitution and not old.is_substitution and not v_player_changed then
      raise exception 'a free substitution must change the player'
        using errcode = 'P0001';
    end if;
  end if;

  if v_player_changed then
    if new.is_substitution then
      if tg_op <> 'UPDATE' then
        raise exception 'a free substitution must be an update to an existing pick'
          using errcode = 'P0001';
      end if;
      -- One column records who was replaced, so one substitution per pick:
      -- otherwise the same row could be swapped again and again before
      -- kickoff while only ever counting once.
      if old.is_substitution then
        raise exception 'this pick has already used its free substitution'
          using errcode = 'P0001';
      end if;
      if old.fixture_id is null or new.fixture_id is distinct from old.fixture_id then
        raise exception 'a free substitution must stay within the same fixture'
          using errcode = 'P0001';
      end if;

      select * into v_fixture from fixtures where id = new.fixture_id;

      if v_fixture.event is distinct from new.gameweek then
        raise exception 'a free substitution must stay within a fixture of gameweek %', new.gameweek
          using errcode = 'P0001';
      end if;
      if v_fixture.kickoff_time is null or v_fixture.kickoff_time <= now() then
        raise exception 'a free substitution must be made before fixture % kicks off', new.fixture_id
          using errcode = 'P0001';
      end if;

      select team_id into v_team from players where code = new.player_code;
      if v_team is distinct from v_fixture.team_h and v_team is distinct from v_fixture.team_a then
        raise exception 'a free substitution must be for a player in fixture %', new.fixture_id
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

-- --------------------------------------------------------------------------
-- 2. Email addresses and phone numbers were readable by every entrant.
-- --------------------------------------------------------------------------
-- "entrants readable" is `using (true)` because everyone needs everyone's
-- display name, and the row carries email and phone alongside it. RLS is
-- row-shaped, so the fix is a column privilege: the table-level SELECT that
-- Supabase's default grants hand out is withdrawn and the non-contact columns
-- granted back one by one. Nothing that runs as the entrant reads the two
-- withheld columns — the views and standings_at() select id and display_name
-- only, and every alert trigger and the edge functions are the definer or the
-- service role. UPDATE is untouched, so the settings and claim screens still
-- write phone and email as before; supabase-js sends return=minimal unless
-- asked, so nothing comes back that needs reading.
revoke select on public.entrants from authenticated, anon;
grant select (id, auth_user_id, display_name, sms_opt_in, nomination_player_code, avatar_updated_at, created_at)
  on public.entrants to authenticated;

-- Your own contact details, and only yours. The definer is what lets it read
-- the columns just withheld; auth.uid() is what keeps it to one row.
create or replace function public.my_contact()
returns table (email text, phone text)
language sql stable security definer set search_path = public as $$
  select e.email, e.phone from public.entrants e where e.auth_user_id = auth.uid()
$$;
revoke all on function public.my_contact() from public;
grant execute on function public.my_contact() to authenticated;

-- --------------------------------------------------------------------------
-- 3. An entrant could write any email into their own row.
-- --------------------------------------------------------------------------
-- The email is where reminders go, so it is the address they signed in with
-- and nothing else: an entrant's update has it copied from auth.users whatever
-- the request said. The claim flow sends the same address, so it is unchanged
-- by this. The results sync and the SQL editor are left alone.
create or replace function entrants_guard_contact()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.role() = 'authenticated' and new.auth_user_id is not null then
    new.email := (select u.email from auth.users u where u.id = new.auth_user_id);
  end if;
  return new;
end $$;

create trigger entrants_contact_guard
  before update on entrants
  for each row execute function entrants_guard_contact();

-- A display name is rendered in a 32px avatar ring and a standings strip; the
-- longest real one is thirteen characters.
alter table entrants add constraint entrants_display_name_len
  check (char_length(display_name) between 1 and 40);

-- --------------------------------------------------------------------------
-- 4. A push endpoint could point anywhere.
-- --------------------------------------------------------------------------
-- `notify` POSTs an encrypted payload to whatever URL the subscription row
-- holds, with the service role's egress — so a row an entrant wrote pointing
-- at an internal address is a request the platform makes on their behalf. The
-- browsers that can install this app subscribe through four push services.
alter table push_subscriptions add constraint push_subscriptions_endpoint_allowed
  check (endpoint ~ '^https://(fcm\.googleapis\.com|([a-z0-9-]+\.)*push\.apple\.com|updates\.push\.services\.mozilla\.com|([a-z0-9-]+\.)*notify\.windows\.com)/');
