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
- **Never embed `players` from `picks` without naming the constraint.**
  `picks` has two foreign keys into `players` (`player_code` and
  `substituted_from_player_code`), so PostgREST rejects a bare
  `.select("players(...)")` as ambiguous (PGRST201) and returns *no rows* —
  which every caller here reads as "nobody has picked", not as an error.
  That is how the season record on `/leaderboard` came to show 38 blank
  gameweeks for someone who had scored. Always
  `players!picks_player_code_fkey(...)`. Pinned by a pgTAP test.
- **Season stats on `players` (`goals_scored`, `assists`, `starts`,
  `minutes`) are nullable and mean it.** Null is "not synced yet", not zero;
  the picker prints "Season stats not synced yet" rather than a confident 0.
  Same reasoning as never storing points.
- **Only the middleware may spend a refresh token.** Supabase rotates the
  refresh token on every use and treats a retired one coming back as theft —
  it revokes the whole session. So any response that drops the `Set-Cookie`
  from a refresh signs the entrant out for good, which is what every
  `NextResponse.redirect` in `lib/supabase/middleware.ts` used to do; they
  now copy the cookies across. Same reason `/api` is out of the middleware
  matcher: a leaderboard fires ~38 player-image requests at once and each was
  racing to rotate the same token.
- **`getSessionUser()` is the read path's `getUser()`, and only the read
  path's.** `supabase.auth.getUser()` is a network round trip to the auth
  server every call — supabase-js never trusts a cached copy — and rendering
  `/login` was making three of them (middleware, `Nav`, the page) to decide
  whether to show one email field. `getSessionUser()` in `lib/supabase/server.ts`
  wraps it in React `cache()`, which is per-request. Don't reach for it inside a
  server action that signs someone in or out: there the whole point is to
  observe the change this request just made.
- **Inputs are 16px on coarse pointers** (`.input`, in `globals.css`). Below
  that, iOS Safari zooms the page in on focus and the layout viewport ends up
  wider than the screen — felt as the field flying off the side when you tap
  it. The picker's search box hit this first and fixed it locally; the login
  field then hit the identical thing, so the rule now lives on `.input` where
  a new field can't miss it. Pinned by `tests/responsive.test.ts`.
- **Sign-in runs server-side** (`app/login/actions.ts`), not from the browser
  client. A session established with `document.cookie` is capped at seven
  days by Safari's tracking prevention no matter what expiry is asked for —
  on an installed PWA that is the difference between signing in once a season
  and once a week. Established over a `Set-Cookie` header it is not capped.
- **A fixture is "played" when `played` is true, never `finished` alone.**
  FPL does not flip `finished` at full time — measured here, all ten GW1
  fixtures still read `finished: false` three days after kickoff while the
  same payload carried `finished_provisional: true` and `minutes: 90`.
  `played` is a generated column (`finished or finished_provisional`) so
  there's one answer and no caller can forget half the condition. Reading
  `finished` alone is what silently stopped the double-gameweek penalty
  ever firing; there's a pgTAP test pinning this.
- **"Playing right now" is decided in `lib/live.ts`, not from one column.**
  `played` is the only thing trusted to *end* a match (see the `finished`
  invariant above — a fixture finished last night still reads
  `finished: false`), but `started` is mirrored by `score` on a ten-minute
  cron, so waiting for it means the LIVE badge appears after the first goal.
  So the clock starts a match, `played` ends it, and a 150-minute cap stops a
  tab nobody reloads claiming LIVE until Thursday. The same module returns the
  moment the answer could next change, which is what `LiveTick` sleeps on
  instead of polling. Pinned by `lib/live.test.ts`.
- **FPL blocks are about the IP, not the request.** Fastly refuses
  Supabase's edge-function egress in bursts — every path including the
  homepage, 403 in 1-4ms with `server: Varnish`. Nine header shapes were
  measured as identical inside a burst and all fine ninety seconds later.
  Don't spend another round making requests look more browser-like: the
  levers that work are the Vercel proxy (`app/api/fpl/[...path]`) and the
  per-invocation retry budget in `_shared/fpl.ts`.
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
- `.github/workflows/backup.yml` + `scripts/backup.mjs` — the daily copy of
  entrants, picks and past winners, committed to `backups/`. Supabase's free
  plan has no backups and no PITR, so this is the only second copy that
  exists. It deliberately skips players, teams, fixtures and goals: all of it
  comes back from the FPL API on the next `sync-fpl`/`score` run, and copying
  it would bury the rows that can't be reconstructed. The points column in the
  CSV is re-derived from `pick_points()`'s rule rather than stored, for the
  same reason the app never stores it.
- **Alerts are one pipeline, not several.** Every alert — a goal, a pick,
  injury news, a reminder, a gameweek settling — is written to
  `notifications` (by a trigger, or by `remind`), and the `notify` edge
  function delivers it outward to whichever channels `alert_prefs` says that
  entrant wants. Nothing sends directly any more. `alert_prefs` splits two
  questions that used to be tangled: the *types* decide whether an event is
  generated for you at all, the *channels* decide how it reaches you, and the
  in-app feed always gets everything generated because it is the one channel
  that needs no configuration to work.
- **The goal-alert clock is two crons, not one.** A goal reaches a phone only
  after `score` notices it and then `notify` dispatches it, so the delay is
  the sum of both schedules — measured at 15 minutes on Isak's gameweek 2
  goal, when `notify` ticked 4 seconds before the trigger wrote the row.
  `notify` now runs every minute (it costs one empty indexed query when there
  is nothing to send) and `score` every three, but only inside a fixture's
  match window rather than for the whole three-and-a-half days a gameweek
  spends unfinished — which is *fewer* FPL requests per gameweek than the old
  ten-minute always-on schedule, not more. If you widen that window, check the
  invocation count first; FPL's Fastly layer is the constraint.
- **`notifications.delivered_at` means "the dispatcher has considered this",
  not "someone received it".** It is stamped whatever happened, including
  total failure. Stamping only successes is exactly how the old reminder
  ended up retrying an unsendable null address every fifteen minutes for a
  whole gameweek.
- **A browser-invoked edge function must deploy with `verify_jwt` off and
  check the caller itself** (`_shared/cors.ts`). The CORS preflight carries no
  credentials by design, so the gateway 401s it before the function runs; the
  browser then never sends the real request and supabase-js reports "Failed to
  send a request to the Edge Function", which reads like the function is broken
  when nothing has executed at all. `push-test` is the only one of these — it
  reads the caller's own token, resolves it to an entrant, and only ever pushes
  to that entrant's own subscriptions.
- `supabase/functions/` — `sync-fpl` (hourly + pre-lock), `score` (every 10
  min live + daily settle), `remind` (every 15 min), `push-test` (on demand
  from Settings), `sheets-backup`
  `notify` (every 5 min — the only thing that sends email/SMS/push),
  `sheets-backup`
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
- **Web push is hand-rolled in `_shared/webpush.ts`** (VAPID per RFC 8292,
  aes128gcm per RFC 8291) because the npm libraries want node's crypto/https.
  Getting it wrong is *silent* — a push that fails to decrypt is dropped by
  the browser with no error surfaced anywhere — so the implementation is
  pinned to the worked example in RFC 8291 §5 and reproduces it byte for
  byte. If you touch the key derivation, re-run that vector; the order of the
  two HKDF rounds (auth secret first, then the message salt) is the easiest
  thing to get backwards and it fails invisibly.
- **iOS only allows push for an installed PWA.** That's why the home-screen
  prompt came first, and why `PushToggle` distinguishes "not supported" from
  "add to home screen first" rather than showing one dead button.
- **Theming lives entirely in the colour tokens** on `:root` in
  `globals.css`; `:root[data-theme="dark"]` restates them and nothing else
  changes, because every component reads them through `var()`. The dark
  neutral ramp is the light one *inverted* rather than re-picked — components
  use low numbers as backgrounds and high numbers as text, so flipping the
  values keeps those roles right way up. A scrim can't come from that ramp
  (it must darken in both themes), hence `--color-scrim`; `--color-closed` is
  outside it for a different reason — it is the one non-green in the system,
  because a locked deadline should not look like the good news everything
  else in the accent colour is. `data-theme` is
  always stamped explicitly, including for "system", by the blocking script
  in `layout.tsx` — that's what stops a white flash before hydration, and
  it's why the stylesheet needs no `prefers-color-scheme` block.
- `scripts/icons.mjs` (`npm run icons`) — every app icon, generated from one
  SVG so the set stays editable. The W is drawn as stroked paths, not SVG
  text: text needs Archivo available to whatever rasterises it, and a missing
  font substitutes silently, so you would get the wrong typeface and no error.
  A mitred join on a V that sharp throws its point well past the vertex, so
  the path's numbers are chosen to centre the *ink*, not the geometry — check
  with a bounding-box measurement rather than by eye if you move them.
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
