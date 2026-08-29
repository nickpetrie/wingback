-- The nomination is meant to be locked before the season starts: it's the one
-- player you may pick twice, so being able to swap it in March — once you can
-- see who is actually scoring — is worth more than any other decision in the
-- game. That was never enforced, and the season is already two gameweeks old,
-- so the line is drawn at the end of the current gameweek instead.

create table season_config (
  -- One row, forever. The check plus the default is what makes that true
  -- rather than merely intended.
  id smallint primary key default 1 check (id = 1),
  nominations_lock_after_gameweek smallint not null references gameweeks(id)
);

alter table season_config enable row level security;
create policy "season config readable" on season_config
  for select to authenticated using (true);

-- Gameweek 2. Everyone has nominated, so nobody is shut out by this.
--
-- Conditional because gameweeks are mirrored from FPL, not created here: on a
-- database rebuilt before the first sync-fpl run there is no gameweek 2 to
-- point at, and a hard insert would fail the whole migration. With no row,
-- nominations_locked() returns false and nominations simply stay open, which
-- is the right way round to fail.
do $$
begin
  if exists (select 1 from gameweeks where id = 2) then
    insert into season_config (nominations_lock_after_gameweek) values (2)
    on conflict (id) do nothing;
  else
    raise notice 'no gameweek 2 yet — set season_config once fixtures have synced';
  end if;
end $$;

create or replace function nominations_locked()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select g.finished
       from season_config c
       join gameweeks g on g.id = c.nominations_lock_after_gameweek),
    false
  )
$$;

create or replace function entrants_guard_nomination()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.nomination_player_code is not distinct from old.nomination_player_code then
    return new;
  end if;

  if not nominations_locked() then
    return new;
  end if;

  -- Setting one for the first time is still allowed after the lock. Someone
  -- who never nominated would otherwise lose the second use entirely, which
  -- is a harsher punishment than the rule is trying to impose — and the rule
  -- is about not *changing* your mind once the season can be read.
  if old.nomination_player_code is null then
    return new;
  end if;

  raise exception 'nominations closed at the end of gameweek %',
    (select nominations_lock_after_gameweek from season_config)
    using errcode = 'P0001';
end $$;

create trigger entrants_nomination_guard
  before update on entrants
  for each row execute function entrants_guard_nomination();
