# Wingback

A private Next.js + Supabase app for five friends running a season-long
Premier League goalscorer sweepstake. See `wingback-brief.md` (if present)
for the full product spec; this file is the fast-orientation summary for
future sessions, and `DEPLOY.md` covers setup/deployment specifically.

## What this is

Each gameweek every entrant picks one PL player they think will score, at
a £3 or £6 (doubled points) stake. Points accrue over 38 gameweeks. The
two problems this replaces a Google Sheet for: people forgetting to pick
(→ reminders) and goals miscounted by hand (→ synced from the FPL API and
derived in SQL). Picks are visible to everyone as soon as they're made —
matching the old sheet, and a deliberate choice, not an oversight — but
the *lock* is still enforced in the database: `picks_guard` refuses any
insert/update on a picks row once its gameweek has locked, regardless of
what the app tries to send.

## Architecture, in one paragraph

Next.js App Router (Vercel) talks to Postgres only through the Supabase
anon key + the viewer's session, so every query runs under RLS — that's
what makes the *write*-side rules (who can submit or change a pick, and
that nobody can once its gameweek has locked) actually hold, regardless of
what the app's own code does or doesn't check. The FPL API has no
CORS headers and can't be called from the browser, and its bootstrap
payload is ~5MB, so all FPL access lives in Supabase Edge Functions
(`supabase/functions/`), which use the service-role key (never present in
the Next.js app or any `NEXT_PUBLIC_*` var). `pg_cron` (inside Postgres,
not Vercel Hobby cron) fires those functions on a schedule via `pg_net`,
reading the project URL and service key from Supabase Vault at call time.

## Key invariants — don't casually change these

- **Points are never stored.** `pick_points()` and the `pick_scores` /
  `leaderboard` views derive them from `goals`, `stake`, and
  `element_type` every time. If you're tempted to add a `points` column,
  don't — that's exactly the "spreadsheet miscounts goals" problem again.
- **`pick_scores` and `leaderboard` are `security_invoker` views.**
  Without that, they run as the view owner and silently bypass the picks
  table's `to authenticated` restriction — an anon request could read
  every pick straight through the view even though the table itself
  denies it outright. This is covered by a pgTAP test — if you add a new
  view over `picks`, give it the same treatment and a test to match.
- **Picks are visible to everyone the moment they're made** (see
  `20260101000009_public_picks.sql`) — there's no lock-based secrecy to
  preserve here. Don't reintroduce a "hide until lock" SELECT policy
  without it being an explicit, discussed decision; it was deliberately
  removed once already.
- **`players.code` is the join key, not `id`.** `code` is stable across
  seasons; `id`/`fpl_id` only means anything within the current season and
  is only used to hit `/event/{gw}/live/`.
- **The picks guard trigger (`picks_guard`, in
  `20260101000001_functions.sql`) has two independent conditions**: the
  lock check fires on a *choice* change (player or stake); the reuse check
  fires only on a *player* change. Recording goals (an update touching
  neither) must trip neither — conflating them lets a goal-sync run
  retroactively invalidate an unrelated gameweek's pick.
- **Never `.upsert()` a pick from the app.** An upsert's BEFORE INSERT
  trigger still fires for the candidate row even when it resolves via ON
  CONFLICT DO UPDATE, which re-runs the once-per-season reuse check as if
  it were a fresh usage. `app/pick/actions.ts` checks for an existing row
  and does an explicit insert or update instead.
- **A fixture is "played" when `played` is true, never `finished` alone.**
  FPL does not flip `finished` at full time — measured here, all ten GW1
  fixtures still read `finished: false` three days after kickoff while the
  same payload carried `finished_provisional: true` and `minutes: 90`.
  `played` is a generated column (`finished or finished_provisional`) so
  there's one answer and no caller can forget half the condition. Reading
  `finished` alone is what silently stopped the double-gameweek penalty
  ever firing; there's a pgTAP test pinning this.
- **`lock_at` is a plain column, kept in sync by a trigger on `fixtures`**
  (`recompute_gameweek_lock_at`), not a generated column — `timestamptz`
  aggregate arithmetic is `stable`, not `immutable`, so Postgres rejects a
  generated column here.

## Where things live

- `supabase/migrations/` — schema, RLS, triggers, views, pg_cron. Applied
  in filename order; `20260101000004_cron.sql` needs pg_cron/pg_net/Vault
  and only makes sense on an actual Supabase project.
- `supabase/tests/` — the pgTAP rules suite, runnable locally with a plain
  `psql` (no Docker/Supabase CLI needed): `supabase/tests/run.sh`. See
  `00_local_harness.sql` for what it stubs out (`auth.uid()`/`auth.role()`,
  roles) to stand in for the real Supabase platform.
- `supabase/functions/` — `sync-fpl` (hourly + pre-lock), `score` (every 10
  min live + daily settle), `remind` (every 15 min), `sheets-backup`
  (hourly, optional — one-way mirror of standings/picks into a Google
  Sheet, see DEPLOY.md §3b; `_shared/google.ts` hand-rolls the service-
  account JWT flow since there's no Deno-friendly googleapis client). All
  Deno; the only place in the codebase that calls
  `fantasy.premierleague.com` is `sync-fpl`/`_shared/fpl.ts`.
- `lib/supabase/` — `server.ts`/`client.ts` (anon key + session, RLS
  always on), `middleware.ts` (session refresh, used by `proxy.ts`),
  `types.ts` (hand-written `Database` type — there's no live project to
  run `supabase gen types` against; keep it in sync by hand and don't
  drop the `Relationships` field on any table/view, or every derived
  query type quietly collapses to `never`).
- `app/page.tsx` (home), `app/pick`, `app/leaderboard` — the three main
  views. There's no standalone `/album` route: each entrant's 38-gameweek
  season record is folded into their expandable row on `/leaderboard`
  (`app/leaderboard/LeaderboardTable.tsx`), not a separate page.
- `app/Header.tsx` (+ `app/Nav.tsx` as its async data-fetching wrapper) is
  the one persistent chrome element — wordmark, gameweek/countdown, menu,
  and the always-visible standings strip — replacing what used to be three
  separate components (`GameweekStatusBar`, `LeaderboardStrip`, plus
  `Nav`'s old nav-only role). `app/GoalToasts.tsx` mounts inside it, gated
  on the gameweek being locked, and subscribes to Supabase Realtime on
  `picks` UPDATEs to fire a toast when someone's `goals` increases.
- `app/api/player-image/[code]/route.ts` — fetches the official headshot
  server-side, posterises it onto the club colour with `sharp`, falls back
  to a procedural monogram card (never an AI-generated likeness) when
  there's no photo or the CDN path has moved again.

## Running the rules test suite

No Docker needed — it runs against a plain local Postgres with the pgTAP
extension:

```bash
supabase/tests/run.sh
```

This is the thing to run after touching any migration in
`supabase/migrations/000000`–`000003`. It seeds its own fixtures and drops
the scratch database each time; never point it at a real project.

## Conventions

- No comments explaining *what* code does; only *why*, when it's
  non-obvious (a rule from the brief, a Postgres quirk, a trap already hit
  once).
- Don't add abstractions or config the current rules don't need.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
