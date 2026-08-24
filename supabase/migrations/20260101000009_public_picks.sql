-- Picks are now visible to everyone as soon as they're made, matching how
-- the old spreadsheet worked — nobody expected secrecy there, and keeping
-- it back until lock was solving a problem the group didn't actually have.
-- This intentionally reverses the "own picks always visible" policy from
-- 20260101000006. The lock itself is unaffected: picks_guard still refuses
-- any insert/update once a gameweek has locked, so this only changes who
-- can *see* a pick, never who can change one.
drop policy "own picks always visible" on picks;
create policy "picks are visible to all entrants" on picks
  for select to authenticated using (true);
