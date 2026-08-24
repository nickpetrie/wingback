-- Team crests (resources.premierleague.com/premierleague/badges/70/t{code}.png)
-- are keyed by the team's stable `code`, not its per-season `id`. Nullable
-- because existing rows only backfill on the next sync-fpl run.
alter table teams add column code integer;
