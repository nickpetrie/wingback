# Deploying Wingback

Five users, so this is all free-tier: Supabase (Postgres + Auth + Edge
Functions), Vercel (Hobby), Resend (email), Twilio (SMS).

## 1. Create the Supabase project

1. Create a project at supabase.com. Note the project URL and, from
   Project Settings → API, the `anon` key and the `service_role` key.
2. Push the schema:
   ```bash
   supabase link --project-ref <your-project-ref>
   supabase db push
   ```
   This applies every file in `supabase/migrations/` in order, including
   `20260101000004_cron.sql` — which enables `pg_cron` and `pg_net`. If
   your project doesn't have `pg_net` available, enable it from the
   Database → Extensions page first and re-run.
3. Enable **magic-link** email auth: Authentication → Providers → Email,
   turn off "Confirm email" if you want the first sign-in to be
   frictionless (five known friends; the risk this protects against
   doesn't really apply here), and set the Site URL / Redirect URLs
   (Authentication → URL Configuration) to your Vercel domain plus
   `http://localhost:3000` for local dev, both with `/auth/confirm`
   allowed as a redirect target.

## 2. Vault secrets — the step that fails silently

`pg_cron` jobs call the edge functions over HTTP via `pg_net`, using the
project URL and service-role key read from **Supabase Vault** at call
time (see `call_edge_function()` in `20260101000004_cron.sql`). Nothing
enforces that these secrets exist. If they're missing, every cron job
still fires exactly on schedule, the function call is skipped, and
**nothing visibly fails** — no error in the dashboard, just reminders that
never send and scores that never update. The migration at least turns
this into a `WARNING` in the Postgres logs (Logs → Postgres Logs, filter
for `wingback:`), but you have to go looking for it.

Set them once, right after the first `db push`, via the SQL editor:

```sql
select vault.create_secret('https://<your-project-ref>.supabase.co', 'project_url');
select vault.create_secret('<your-service-role-key>', 'service_role_key');
```

If you ever rotate the service-role key, update the secret with
`vault.update_secret`, not a fresh `create_secret` — the lookup in
`call_edge_function()` matches on `name`.

## 3. Deploy the edge functions

```bash
supabase functions deploy sync-fpl
supabase functions deploy score
supabase functions deploy remind
```

Then set their secrets (Resend/Twilio — `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` are injected automatically by the platform,
you don't set those):

```bash
supabase secrets set RESEND_API_KEY=... REMINDER_FROM_EMAIL=wingback@yourdomain.com
supabase secrets set TWILIO_ACCOUNT_SID=... TWILIO_AUTH_TOKEN=... TWILIO_FROM_NUMBER=+1...
```

Missing Resend/Twilio secrets fail the same silent way from `remind`'s
point of view: the `reminders_sent` insert still lands, the send throws,
the function catches it, deletes the marker, and logs to the function's
own log stream (Functions → remind → Logs) — but the cron job itself
reports success either way. Check those logs once after first deploy.

**Do an initial manual sync before anyone signs in**, otherwise the app
has no players/gameweeks yet:

```bash
curl -X POST https://<project-ref>.supabase.co/functions/v1/sync-fpl \
  -H "Authorization: Bearer <service-role-key>"
```

## 3b. Google Sheets backup (optional)

`sheets-backup` mirrors the live leaderboard and full pick history into a
Google Sheet once an hour, as a human-readable backup outside Postgres. It
only ever writes — point it at a fresh sheet you create for this, never at
the group's own manually-edited tracker, since a conflicting hand-edit and
an hourly overwrite don't mix.

1. In Google Cloud Console: create a project (or reuse one), enable the
   **Google Sheets API**, then create a **service account** and generate a
   JSON key for it (IAM & Admin → Service Accounts → Keys → Add key).
2. Create a new Google Sheet with two tabs named exactly `Leaderboard` and
   `Picks` (case-sensitive — the function writes to `Leaderboard!A1` and
   `Picks!A1`). Share it with the service account's email address (found in
   the JSON key as `client_email`) as **Editor**.
3. Deploy the function and set its secrets from the JSON key:
   ```bash
   supabase functions deploy sheets-backup
   supabase secrets set \
     GOOGLE_SERVICE_ACCOUNT_EMAIL=<client_email from the JSON key> \
     GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=<private_key from the JSON key, as one line with \n escapes intact> \
     GOOGLE_SHEETS_BACKUP_ID=<the sheet's ID, from its URL>
   ```
   The private key in the JSON file already has `\n` escapes rather than
   real newlines — paste it exactly as it appears in the JSON (still
   wrapped in quotes if your shell needs that to treat it as one value);
   the function converts those back to real newlines itself.
4. Run `supabase db push` to pick up `20260101000012_sheets_backup_cron.sql`,
   which schedules it hourly. Trigger it manually once to confirm it works:
   ```bash
   curl -X POST https://<project-ref>.supabase.co/functions/v1/sheets-backup \
     -H "Authorization: Bearer <service-role-key>"
   ```
   A `{"ok": false, ...}` response means a secret is missing or the sheet
   isn't shared with the service account — the error message names which.

Skip this whole section if you don't want it; nothing else in the app
depends on `sheets-backup` existing.

## 4. Deploy the app to Vercel

Import the repo, set these env vars (Project Settings → Environment
Variables):

```
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
```

That's it — **the service-role key never goes here**. If a future change
seems to need it in the app tier, that's a sign the change belongs in an
edge function instead, not a reason to add `SUPABASE_SERVICE_ROLE_KEY` to
Vercel.

Do not use Vercel's own Cron feature for anything here: Hobby-tier cron
runs once a day, which is useless for a T-2h reminder, and pg_cron
already covers it from inside Postgres — which also happens to be what
keeps the free Supabase project from pausing after a week of no traffic.

## 5. Five sign-ins

Send each person the app URL. First magic-link sign-in creates their
`entrants` row automatically (`on_auth_user_created` trigger) with
`display_name` defaulted from their email's local part — have each of
them set their `nomination_player_code` once (SQL editor, or add a
settings UI later) before gameweek 1 locks, since the brief's nomination
exception only applies to a player picked *before the season starts*.

## Local development

```bash
cp .env.local.example .env.local   # fill in the same two NEXT_PUBLIC_ vars
npm install
npm run dev
```

`npm run typecheck` and `npm run build` don't need a real Supabase project
(they use whatever's in `.env.local`, even placeholder values — every page
is dynamically rendered, nothing fetches at build time). Running the app
for real against `localhost:3000` does need a real project, since auth and
data both go through it.

To change or extend the rules engine, run the pgTAP suite instead of
spinning up Supabase locally — it needs nothing but a local `psql`:

```bash
supabase/tests/run.sh
```
