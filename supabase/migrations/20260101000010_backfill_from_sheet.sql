-- One-time backfill from the 2026/27 "Wingback PL goal tracker" Google
-- Sheet, which the group was already using for the season's opening
-- gameweek before this app existed: nominated ("double pick") players and
-- the gameweek-1 picks already made. Matches are name-based (display_name
-- for entrants, web_name for players) and every block is guarded to no-op
-- rather than error if a name doesn't resolve — safe to run even if
-- players/gameweeks haven't fully synced yet.
do $$
declare
  v_haaland integer;
  v_gyokeres integer;
  v_havertz integer;
  v_alex uuid;
  v_nick uuid;
  v_casra uuid;
begin
  select code into v_haaland from players where web_name ilike 'haaland' limit 1;
  select code into v_gyokeres from players where web_name ilike 'gy_keres' limit 1;
  select code into v_havertz from players where web_name ilike 'havertz' limit 1;

  select id into v_alex from entrants where display_name = 'Alex Beetles';
  select id into v_nick from entrants where display_name = 'Nick Petrie';
  select id into v_casra from entrants where display_name = 'Casra Abedian';

  -- Double pick (nomination) selections.
  if v_nick is not null and v_haaland is not null then
    update entrants set nomination_player_code = v_haaland where id = v_nick;
  else
    raise notice 'skipped Nick''s nomination: entrant or player (Haaland) not found';
  end if;

  if v_casra is not null and v_haaland is not null then
    update entrants set nomination_player_code = v_haaland where id = v_casra;
  else
    raise notice 'skipped Casra''s nomination: entrant or player (Haaland) not found';
  end if;

  -- Gameweek 1 picks already made before this app existed. picks_guard's
  -- lock check would otherwise reject an insert into an already-locked
  -- gameweek, so it's disabled just for this backfill; goals are left at
  -- the column default (0) and pick up the real value on the next score
  -- sync, same as any other pick.
  if not exists (select 1 from gameweeks where id = 1) then
    raise notice 'skipped gameweek-1 backfill: gameweek 1 not synced yet';
    return;
  end if;

  alter table picks disable trigger picks_guard_trigger;

  if v_alex is not null and v_gyokeres is not null then
    insert into picks (entrant_id, gameweek, player_code, stake)
    values (v_alex, 1, v_gyokeres, 3)
    on conflict (entrant_id, gameweek) do nothing;
  else
    raise notice 'skipped Alex''s gameweek-1 pick: entrant or player (Gyokeres) not found';
  end if;

  if v_nick is not null and v_havertz is not null then
    insert into picks (entrant_id, gameweek, player_code, stake)
    values (v_nick, 1, v_havertz, 3)
    on conflict (entrant_id, gameweek) do nothing;
  else
    raise notice 'skipped Nick''s gameweek-1 pick: entrant or player (Havertz) not found';
  end if;

  alter table picks enable trigger picks_guard_trigger;
end $$;
