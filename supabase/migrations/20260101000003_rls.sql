-- Hidden picks are enforced here, in the database, not in the interface.
-- Anything sent to a browser has been sent, whatever the UI renders.

alter table teams enable row level security;
alter table players enable row level security;
alter table gameweeks enable row level security;
alter table fixtures enable row level security;
alter table player_status_history enable row level security;
alter table fixture_goals enable row level security;
alter table entrants enable row level security;
alter table picks enable row level security;
alter table reminders_sent enable row level security;

-- Reference data mirrored from FPL: readable by any signed-in entrant.
-- Writes only ever happen via edge functions on the service role, which
-- bypasses RLS entirely, so no insert/update/delete policies are needed here.
create policy "reference data readable" on teams for select to authenticated using (true);
create policy "reference data readable" on players for select to authenticated using (true);
create policy "reference data readable" on gameweeks for select to authenticated using (true);
create policy "reference data readable" on fixtures for select to authenticated using (true);
create policy "reference data readable" on player_status_history for select to authenticated using (true);
create policy "reference data readable" on fixture_goals for select to authenticated using (true);

-- Five friends: everyone can see everyone's display name/nomination, but
-- only the owner can change their own row.
create policy "entrants readable" on entrants for select to authenticated using (true);
create policy "entrants self update" on entrants for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- The rule that decides the architecture: a pick is invisible to everyone
-- but its owner until the gameweek locks, then visible to all. Enforced as
-- RLS so no application code path can leak it early.
create policy "own picks always visible" on picks
  for select to authenticated
  using (
    entrant_id = auth.uid()
    or exists (
      select 1 from gameweeks g
      where g.id = picks.gameweek and now() >= g.lock_at
    )
  );

create policy "entrants manage own picks" on picks
  for insert to authenticated
  with check (entrant_id = auth.uid());

create policy "entrants update own picks" on picks
  for update to authenticated
  using (entrant_id = auth.uid())
  with check (entrant_id = auth.uid());

-- Reminders are an internal bookkeeping table for the edge functions
-- (service role only); entrants may see their own reminder history.
create policy "own reminders visible" on reminders_sent
  for select to authenticated using (entrant_id = auth.uid());
