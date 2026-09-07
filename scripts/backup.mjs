// Snapshots the sweepstake's irreplaceable rows out of Supabase and into this
// repository.
//
// Why here rather than a Google Sheet: the sheet mirror needs a Google Cloud
// project, a service account and a downloaded key, which is a lot of desk to
// set up for a few kilobytes. The whole season is five entrants, thirty-eight
// picks each and a handful of past winners — everything else (players, teams,
// fixtures, goals) is reference data that sync-fpl and score rebuild from the
// FPL API on their next run, so it is not worth backing up. What is left is
// small enough to live in git, which is already off Supabase, already
// versioned, and already readable from a phone.
//
// Reads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from the environment. No
// dependencies: Node's own fetch, so the workflow needs no install step.

import { pointsFor } from "./points.mjs";
import { buildState } from "./state.mjs";

const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must both be set.");
  process.exit(1);
}

async function select(path) {
  const res = await fetch(`${url}/rest/v1/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) throw new Error(`${path} responded ${res.status}: ${await res.text()}`);
  return res.json();
}

// The snapshot first, and on its own. These three tables are the only rows in
// the database that cannot be rebuilt from somewhere else, so nothing that is
// merely nice to have shares a Promise.all with them — a hiccup fetching the
// leaderboard must not be able to stop the one copy of the season getting out.
const [entrants, picks, winners] = await Promise.all([
  select(
    "entrants?select=id,display_name,email,auth_user_id,nomination_player_code,avatar_updated_at,created_at&order=display_name",
  ),
  select(
    "picks?select=id,entrant_id,gameweek,player_code,fixture_id,stake,goals,is_substitution,substituted_from_player_code,created_at,updated_at&order=gameweek,entrant_id",
  ),
  select("season_winners?select=*&order=season_label"),
]);

// Three tables, and only three. Gameweek deadlines, fixtures, squads and
// per-fixture goals all come back from the FPL API the next time sync-fpl and
// score run, so copying them here would only add noise to the daily diff and
// hide the rows that genuinely cannot be reconstructed.
const snapshot = {
  taken_at: new Date().toISOString(),
  entrants,
  picks,
  season_winners: winners,
};

const { writeFileSync, mkdirSync } = await import("node:fs");
mkdirSync("backups", { recursive: true });
writeFileSync("backups/wingback.json", JSON.stringify(snapshot, null, 2) + "\n");
console.log(
  `Backed up ${entrants.length} entrants, ${picks.length} picks, ${winners.length} past winners.`,
);

// Everything below renders the *readable* files — the CSVs and state.md. None
// of it is part of the snapshot, and none of it needs to be: sync-fpl and
// score rebuild all of it from the FPL API.
//
// It is also deliberately non-fatal. If any of it throws, yesterday's copies
// stay on disk and the run still commits the snapshot above; state.md carries
// the moment it was generated in its first line, so a digest that has stopped
// advancing says so itself rather than pretending to be current.
//
// push_subscriptions is read for entrant_id alone. The p256dh and auth keys on
// that table are the credentials a push is encrypted to, and committing those
// into a repository would be handing out the ability to push to someone's
// phone; state.md only ever needs the count.
try {
  const [players, teams, leaderboard, gameweeks, alertPrefs, pushSubscriptions, syncState, seasonConfig] =
    await Promise.all([
      select("players?select=code,web_name,element_type,team_id"),
      select("teams?select=id,short_name"),
      select("leaderboard?select=*"),
      select("gameweeks?select=id,deadline_time,lock_at,finished&order=id"),
      select("alert_prefs?select=entrant_id,email,sms,push"),
      select("push_subscriptions?select=entrant_id"),
      select("sync_state?select=source,synced_at"),
      select("season_config?select=nominations_lock_after_gameweek&limit=1"),
    ]);

  const playerByCode = new Map(players.map((p) => [p.code, p]));
  const teamById = new Map(teams.map((t) => [t.id, t.short_name]));
  const entrantById = new Map(entrants.map((e) => [e.id, e.display_name]));

  // The rule itself lives in points.mjs so it can be tested; see that file for
  // why the copy exists at all.
  const csvCell = (v) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const toCsv = (header, rows) =>
    [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\n") + "\n";

  const pickRows = picks.map((p) => {
    const player = playerByCode.get(p.player_code);
    return [
      p.gameweek,
      entrantById.get(p.entrant_id) ?? p.entrant_id,
      player?.web_name ?? p.player_code,
      player ? (teamById.get(player.team_id) ?? "") : "",
      p.stake,
      p.goals,
      player ? pointsFor(player.element_type, p.stake, p.goals) : "",
    ];
  });

  const standingsRows = [...leaderboard]
    .sort((a, b) => b.total_points - a.total_points || b.scoring_gameweeks - a.scoring_gameweeks)
    .map((r, i) => [i + 1, r.display_name, r.total_points, r.scoring_gameweeks]);

  writeFileSync(
    "backups/picks.csv",
    toCsv(["gameweek", "entrant", "player", "team", "stake", "goals", "points"], pickRows),
  );
  writeFileSync(
    "backups/standings.csv",
    toCsv(["position", "entrant", "points", "scoring_gameweeks"], standingsRows),
  );
  writeFileSync(
    "backups/state.md",
    buildState({
      entrants,
      picks,
      gameweeks,
      players,
      teams,
      leaderboard,
      alertPrefs,
      pushSubscriptions,
      syncState,
      seasonConfig: seasonConfig?.[0] ?? null,
    }),
  );

  console.log(`Wrote picks.csv, standings.csv and state.md.`);
} catch (error) {
  // A GitHub annotation, so the run's summary page shows it rather than
  // burying it in the log — the readable files are how anyone actually checks
  // this thing is alive.
  console.log(`::warning::Readable files not regenerated: ${error.message}`);
}
