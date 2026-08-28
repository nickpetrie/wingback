# Backups

A second copy of the sweepstake, kept outside Supabase.

The Supabase project is on the free plan, which has no automated backups and
no point-in-time recovery, so until this existed the only record of who picked
what lived in one database. These files are written by
`.github/workflows/backup.yml` at 04:10 UTC daily (and on demand from the
Actions tab) and committed straight back here, so the copy lives on GitHub —
different company, different account, versioned, and readable from a phone.

- `wingback.json` — the restorable snapshot: entrants, every pick, past
  season winners.
- `picks.csv` — every pick with player, club, stake, goals and points.
- `standings.csv` — the table as it stood.

## What is deliberately *not* here

Players, teams, fixtures, gameweek deadlines and per-fixture goals. All of it
is mirrored from the FPL API, and `sync-fpl` and `score` rebuild every row on
their next run. Copying it daily would bury the handful of rows that actually
matter under thousands that don't.

Points aren't stored either — the CSV re-derives them the same way
`pick_points()` does, so a stale backup can't disagree with the app about a
scoreline.

## Restoring

`wingback.json` is three arrays matching the `entrants`, `picks` and
`season_winners` tables column for column, so a restore is an insert per array
followed by a `sync-fpl` run to repopulate the reference data. Note that
`picks_guard` refuses writes to a locked gameweek: restore with the trigger
disabled inside a transaction, or the season's history won't go back in.

## Setup

One repository secret, `SUPABASE_SERVICE_ROLE_KEY` (Supabase → Project
Settings → API). Nothing else — the workflow uses Node's built-in fetch, so
there are no dependencies to install and nothing to keep up to date.
