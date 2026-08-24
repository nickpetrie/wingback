-- Five friends, a fixed roster: entrants exist before anyone has ever
-- signed in, and each person "claims" their profile on first login rather
-- than freely creating an account. That means entrants.id can no longer be
-- required to equal an existing auth.users id (the whole point is that the
-- row exists first) — decouple them via a nullable, unique auth_user_id
-- instead, and drop the auto-create-on-signup trigger that assumed the old
-- 1:1 relationship.

alter table entrants drop constraint entrants_id_fkey;
alter table entrants alter column id set default gen_random_uuid();
alter table entrants add column auth_user_id uuid unique references auth.users(id) on delete set null;
alter table entrants alter column email drop not null;
alter table entrants drop column display_name_set;

drop trigger on_auth_user_created on auth.users;
drop function handle_new_user();

-- Every RLS policy and the picks_guard trigger already key off entrants.id
-- (via picks.entrant_id), which is unaffected by this change — only the
-- policies that resolved "the current user's entrant row" via auth.uid()
-- directly need to go through this instead.
create or replace function current_entrant_id()
returns uuid language sql stable
set search_path = public
as $$
  select id from entrants where auth_user_id = auth.uid()
$$;

drop policy "entrants self update" on entrants;
create policy "entrants self update" on entrants for update to authenticated
  using (auth_user_id = (select auth.uid()))
  with check (auth_user_id = (select auth.uid()));

-- Claiming: any signed-in user may attach themselves to a profile that
-- nobody has claimed yet. The plain UPDATE ... WHERE auth_user_id IS NULL
-- this policy guards is itself the race-safety mechanism — if two people
-- click the same name at once, only the first commits; the second affects
-- zero rows and the app reports "already claimed."
create policy "entrants claim" on entrants for update to authenticated
  using (auth_user_id is null)
  with check (auth_user_id = (select auth.uid()));

drop policy "own picks always visible" on picks;
create policy "own picks always visible" on picks
  for select to authenticated
  using (
    entrant_id = (select current_entrant_id())
    or exists (
      select 1 from gameweeks g
      where g.id = picks.gameweek and now() >= g.lock_at
    )
  );

drop policy "entrants manage own picks" on picks;
create policy "entrants manage own picks" on picks
  for insert to authenticated
  with check (entrant_id = (select current_entrant_id()));

drop policy "entrants update own picks" on picks;
create policy "entrants update own picks" on picks
  for update to authenticated
  using (entrant_id = (select current_entrant_id()))
  with check (entrant_id = (select current_entrant_id()));

drop policy "own reminders visible" on reminders_sent;
create policy "own reminders visible" on reminders_sent
  for select to authenticated using (entrant_id = (select current_entrant_id()));

-- Season winners: who won which season, for the "star per title" badge.
-- A separate table rather than a boolean, since it's meant to show one
-- star per season won (World Cup shirt-star style), not just "has ever won".
create table season_winners (
  season_label text not null,
  entrant_id uuid not null references entrants(id),
  points integer,
  primary key (season_label, entrant_id)
);

alter table season_winners enable row level security;
create policy "season winners readable" on season_winners for select to authenticated using (true);
