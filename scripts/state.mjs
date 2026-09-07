// The season, in one page of Markdown.
//
// `wingback.json` and the CSVs next to it are for *restoring* the database.
// This file is for reading. It exists because answering "who still hasn't
// picked, and when do they have to?" from the snapshot means joining three
// arrays of UUIDs by hand — fine for a script, useless for a person on a
// phone and wasteful for an assistant that would otherwise spend a dozen
// queries rebuilding what the daily backup already had in memory.
//
// It is derived, never restored from: every number here comes back out of the
// snapshot, and points are re-derived by pointsFor() for the same reason the
// app never stores them.

import { pointsFor } from "./points.mjs";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Deterministic, UTC, and unambiguous to a reader in any timezone. Locale
 * formatting would make the daily diff depend on the runner's environment. */
function stamp(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getUTCDay()];
  const month = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ][d.getUTCMonth()];
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${day} ${d.getUTCDate()} ${month} ${d.getUTCFullYear()}, ${hh}:${mm} UTC`;
}

function relative(iso, now) {
  if (!iso) return "";
  const ms = new Date(iso).getTime() - now;
  if (Number.isNaN(ms)) return "";
  const abs = Math.abs(ms);
  const value =
    abs >= DAY_MS
      ? `${Math.round(abs / DAY_MS)}d`
      : abs >= 60 * 60 * 1000
        ? `${Math.round(abs / (60 * 60 * 1000))}h`
        : `${Math.max(1, Math.round(abs / 60000))}m`;
  return ms >= 0 ? `in ${value}` : `${value} ago`;
}

const table = (header, rows) =>
  [
    `| ${header.join(" | ")} |`,
    `| ${header.map(() => "---").join(" | ")} |`,
    ...rows.map((r) => `| ${r.join(" | ")} |`),
  ].join("\n");

export function buildState({
  now = Date.now(),
  entrants = [],
  picks = [],
  gameweeks = [],
  players = [],
  teams = [],
  leaderboard = [],
  alertPrefs = [],
  pushSubscriptions = [],
  syncState = [],
  seasonConfig = null,
} = {}) {
  const playerByCode = new Map(players.map((p) => [p.code, p]));
  const teamById = new Map(teams.map((t) => [t.id, t.short_name]));
  const prefsByEntrant = new Map(alertPrefs.map((a) => [a.entrant_id, a]));
  const name = (code) => playerByCode.get(code)?.web_name ?? (code == null ? "—" : `#${code}`);
  const club = (code) => {
    const player = playerByCode.get(code);
    return player ? (teamById.get(player.team_id) ?? "") : "";
  };
  const points = (pick) => {
    const player = playerByCode.get(pick.player_code);
    return player ? pointsFor(player.element_type, pick.stake, pick.goals ?? 0) : 0;
  };

  const devices = new Map();
  for (const sub of pushSubscriptions) {
    devices.set(sub.entrant_id, (devices.get(sub.entrant_id) ?? 0) + 1);
  }

  const byId = [...gameweeks].sort((a, b) => a.id - b.id);
  // The same rule `remind` uses: the gameweek in play is the earliest one that
  // hasn't settled. Nothing here re-derives it differently, so a disagreement
  // between this file and a reminder is a real bug, not a formatting quirk.
  const open = byId.find((g) => !g.finished) ?? null;
  const settled = [...byId].reverse().find((g) => g.finished) ?? null;

  const picksFor = (gw) => picks.filter((p) => p.gameweek === gw);
  const openPicks = open ? picksFor(open.id) : [];
  const pickedIds = new Set(openPicks.map((p) => p.entrant_id));
  const missing = entrants.filter((e) => !pickedIds.has(e.id));
  const locked = open?.lock_at ? new Date(open.lock_at).getTime() <= now : false;

  const out = [];
  out.push(`# Wingback — season state`);
  out.push("");
  out.push(
    `Generated ${stamp(new Date(now).toISOString())} by \`scripts/backup.mjs\`, on the same daily run that writes the snapshot beside it.`,
  );
  out.push("");
  out.push(
    "Read this first: it is the whole season in one file, so a session can answer questions about who picked what without a database connection. `wingback.json` is the restorable copy; this is the readable one, and it is regenerated from scratch every day rather than edited. Absolute times are the truth — anything phrased as *in 5d* or *45m ago* was measured at the moment above and is that much staler now.",
  );
  out.push("");

  out.push("## Right now");
  out.push("");
  if (!open) {
    out.push("Every gameweek in the table below has settled. The season is over, or `sync-fpl` has not yet loaded the next one.");
  } else {
    out.push(
      `**Gameweek ${open.id}** is the one in play — ${locked ? "locked" : "open for picks"}.`,
    );
    out.push("");
    out.push(`- Deadline: ${stamp(open.deadline_time)} (${relative(open.deadline_time, now)})`);
    out.push(`- Picks lock: ${stamp(open.lock_at)} (${relative(open.lock_at, now)})`);
    out.push(`- Picked: ${openPicks.length} of ${entrants.length}`);
    if (missing.length && !locked) {
      out.push(`- Still to pick: ${missing.map((e) => e.display_name).join(", ")}`);
    } else if (missing.length) {
      out.push(
        `- Missed the deadline: ${missing.map((e) => e.display_name).join(", ")} — \`picks_guard\` refuses a pick now, so these gameweeks score nothing.`,
      );
    }
    if (openPicks.length) {
      out.push("");
      out.push(
        table(
          ["entrant", "player", "club", "stake", "goals", "points"],
          [...openPicks]
            .sort((a, b) => points(b) - points(a))
            .map((p) => {
              const entrant = entrants.find((e) => e.id === p.entrant_id);
              return [
                entrant?.display_name ?? p.entrant_id,
                name(p.player_code),
                club(p.player_code),
                `£${p.stake}`,
                p.goals ?? 0,
                points(p),
              ];
            }),
        ),
      );
    }
  }
  out.push("");

  out.push(`## Standings${settled ? ` (after gameweek ${settled.id})` : ""}`);
  out.push("");
  const standings = [...leaderboard].sort(
    (a, b) => b.total_points - a.total_points || b.scoring_gameweeks - a.scoring_gameweeks,
  );
  out.push(
    table(
      ["#", "entrant", "points", "scoring GWs"],
      standings.map((r, i) => [i + 1, r.display_name, r.total_points, r.scoring_gameweeks]),
    ),
  );
  out.push("");

  out.push("## Nominations");
  out.push("");
  out.push(
    `Each entrant nominates one player they may pick **twice** in the season; everyone else is once only.${
      seasonConfig?.nominations_lock_after_gameweek
        ? ` Nominations lock once gameweek ${seasonConfig.nominations_lock_after_gameweek} has settled.`
        : ""
    }`,
  );
  out.push("");
  out.push(
    table(
      ["entrant", "nomination", "club", "used"],
      entrants.map((e) => {
        const code = e.nomination_player_code;
        const uses = picks.filter((p) => p.entrant_id === e.id && p.player_code === code);
        return [
          e.display_name,
          code ? name(code) : "_none set_",
          code ? club(code) : "",
          code ? `${uses.length}/2${uses.length ? ` (GW ${uses.map((p) => p.gameweek).join(", ")})` : ""}` : "—",
        ];
      }),
    ),
  );
  out.push("");

  out.push("## Every pick so far");
  out.push("");
  const played = byId.filter((g) => picksFor(g.id).length);
  if (!played.length) {
    out.push("Nobody has picked yet.");
  } else {
    out.push(
      table(
        ["GW", ...entrants.map((e) => e.display_name)],
        played.map((g) =>
          [
            g.id,
            ...entrants.map((e) => {
              const pick = picksFor(g.id).find((p) => p.entrant_id === e.id);
              if (!pick) return "—";
              const scored = pick.goals ?? 0;
              return `${name(pick.player_code)}${pick.stake === 6 ? " ×2" : ""}${scored ? ` — ${points(pick)}pt` : ""}`;
            }),
          ].map(String),
        ),
      ),
    );
    out.push("");
    out.push("`×2` is a £6 stake (double points). Per-pick goals and clubs are in `picks.csv`.");
  }
  out.push("");

  out.push("## Who an alert actually reaches");
  out.push("");
  out.push(
    "The in-app feed always gets everything. The other channels only deliver if they are both switched on *and* configured — push needs a device registered from an installed PWA, which is a separate step from the switch and the one that quietly fails.",
  );
  out.push("");
  out.push(
    table(
      ["entrant", "push", "devices", "email", "SMS"],
      entrants.map((e) => {
        const prefs = prefsByEntrant.get(e.id);
        const count = devices.get(e.id) ?? 0;
        const on = (v) => (v ? "on" : "off");
        return [
          e.display_name,
          on(prefs?.push),
          prefs?.push && count === 0 ? "**0 — gets no push**" : String(count),
          on(prefs?.email),
          on(prefs?.sms),
        ];
      }),
    ),
  );
  out.push("");

  out.push("## Upcoming gameweeks");
  out.push("");
  const upcoming = byId.filter((g) => !g.finished).slice(0, 5);
  out.push(
    upcoming.length
      ? table(
          ["GW", "deadline", "when"],
          upcoming.map((g) => [g.id, stamp(g.deadline_time), relative(g.deadline_time, now)]),
        )
      : "None loaded.",
  );
  out.push("");

  out.push("## Freshness");
  out.push("");
  out.push(
    syncState.length
      ? table(
          ["source", "last synced", "when"],
          [...syncState]
            .sort((a, b) => String(a.source).localeCompare(String(b.source)))
            .map((s) => [s.source, stamp(s.synced_at), relative(s.synced_at, now)]),
        )
      : "No sync has been recorded.",
  );
  out.push("");
  out.push(
    "A stale row here means `sync-fpl` or `score` stopped running — the picker would be showing yesterday's injury flags, and goals would stop arriving. Everything above is only as current as this.",
  );
  out.push("");

  return out.join("\n");
}
