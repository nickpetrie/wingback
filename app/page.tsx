import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentGameweek } from "@/lib/gameweek";
import { getCurrentEntrantId } from "@/lib/entrant";
import { STATUS_LABEL } from "./PlayerSearchInput";
import { Countdown } from "./pick/Countdown";
import type { Stake } from "@/lib/supabase/types";

interface Fixture {
  id: number;
  kickoff_time: string | null;
  finished: boolean;
  team_h: number;
  team_a: number;
  home: string;
  away: string;
}

interface RevealedPick {
  entrant_id: string;
  entrant_name: string;
  player_name: string;
  team_id: number;
  team_short_name: string;
  stake: Stake;
  goals: number;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const entrantId = await getCurrentEntrantId(supabase, user.id);
  if (!entrantId) return null; // middleware sends anyone without a claim to /claim first

  const gameweek = await getCurrentGameweek(supabase);

  const { data: fixturesRaw } = gameweek
    ? await supabase
      .from("fixtures")
      .select(
        "id, kickoff_time, finished, team_h, team_a, home:teams!fixtures_team_h_fkey(short_name), away:teams!fixtures_team_a_fkey(short_name)",
      )
      .eq("event", gameweek.id)
      .order("kickoff_time", { ascending: true })
    : { data: null };

  const fixtures: Fixture[] = (fixturesRaw ?? []).map((f) => ({
    id: f.id,
    kickoff_time: f.kickoff_time,
    finished: f.finished,
    team_h: f.team_h,
    team_a: f.team_a,
    home: f.home?.short_name ?? "?",
    away: f.away?.short_name ?? "?",
  }));

  // "Everyone's picks" only ever shows a locked gameweek's picks — RLS hides
  // an open gameweek's other-entrant rows entirely, which is the whole point.
  // Prefer the current gameweek if it's the one that just locked, otherwise
  // fall back to the last one that did, so there's always something to show.
  let revealGameweek: number | null = null;
  if (gameweek?.state === "locked") {
    revealGameweek = gameweek.id;
  } else {
    const { data: latestLocked } = await supabase
      .from("gameweeks")
      .select("id")
      .not("lock_at", "is", null)
      .lte("lock_at", new Date().toISOString())
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();
    revealGameweek = latestLocked?.id ?? null;
  }

  const { data: revealedRaw } = revealGameweek
    ? await supabase
      .from("picks")
      .select("entrant_id, stake, goals, entrants(display_name), players(web_name, team_id, teams(short_name))")
      .eq("gameweek", revealGameweek)
    : { data: null };

  const revealedPicks: RevealedPick[] = (revealedRaw ?? [])
    .filter((p) => p.entrants && p.players)
    .map((p) => ({
      entrant_id: p.entrant_id,
      entrant_name: p.entrants!.display_name,
      player_name: p.players!.web_name,
      team_id: p.players!.team_id,
      team_short_name: p.players!.teams?.short_name ?? "",
      stake: p.stake,
      goals: p.goals,
    }));

  const picksByTeam = new Map<number, RevealedPick[]>();
  for (const p of revealedPicks) {
    picksByTeam.set(p.team_id, [...(picksByTeam.get(p.team_id) ?? []), p]);
  }
  const showPicksOnFixtures = revealGameweek !== null && revealGameweek === gameweek?.id;

  let ownPick: { player_name: string; team_short_name: string; stake: Stake; goals: number } | null = null;
  if (gameweek && showPicksOnFixtures) {
    const mine = revealedPicks.find((p) => p.entrant_id === entrantId);
    ownPick = mine
      ? { player_name: mine.player_name, team_short_name: mine.team_short_name, stake: mine.stake, goals: mine.goals }
      : null;
  } else if (gameweek) {
    const { data: ownPickRaw } = await supabase
      .from("picks")
      .select("stake, goals, players(web_name, teams(short_name))")
      .eq("entrant_id", entrantId)
      .eq("gameweek", gameweek.id)
      .maybeSingle();
    ownPick = ownPickRaw?.players
      ? {
        player_name: ownPickRaw.players.web_name,
        team_short_name: ownPickRaw.players.teams?.short_name ?? "",
        stake: ownPickRaw.stake,
        goals: ownPickRaw.goals,
      }
      : null;
  }

  const playingTeamIds = new Set(fixtures.flatMap((f) => [f.team_h, f.team_a]));
  const { data: newsRaw } = await supabase
    .from("players")
    .select("code, web_name, status, news, team_id, teams(short_name)")
    .neq("news", "")
    .order("web_name");

  const news = (newsRaw ?? [])
    .map((p) => ({
      code: p.code,
      web_name: p.web_name,
      status: p.status,
      news: p.news,
      team_short_name: p.teams?.short_name ?? "",
      playingThisWeek: playingTeamIds.has(p.team_id),
    }))
    .sort((a, b) => Number(b.playingThisWeek) - Number(a.playingThisWeek))
    .slice(0, 8);

  const { data: leaderboard } = await supabase
    .from("leaderboard")
    .select("entrant_id, display_name, total_points, scoring_gameweeks");
  const rows = leaderboard ?? [];
  const ownRank = rows.findIndex((r) => r.entrant_id === entrantId);

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <GameweekCard gameweek={gameweek} ownPick={ownPick} />

      <div className="grid gap-6 md:grid-cols-2">
        <FixturesCard fixtures={fixtures} picksByTeam={showPicksOnFixtures ? picksByTeam : new Map()} />
        <NewsCard news={news} />
      </div>

      {!showPicksOnFixtures && revealedPicks.length > 0 && (
        <RevealCard gameweek={revealGameweek!} picks={revealedPicks} />
      )}

      <StandingsCard rows={rows} ownRank={ownRank} />
    </main>
  );
}

function GameweekCard({
  gameweek,
  ownPick,
}: {
  gameweek: Awaited<ReturnType<typeof getCurrentGameweek>>;
  ownPick: { player_name: string; team_short_name: string; stake: Stake; goals: number } | null;
}) {
  if (!gameweek) {
    return (
      <section className="rounded-2xl border border-dashed border-pitch-900/15 bg-pitch-50 p-6 text-center text-sm text-pitch-900/60">
        No gameweek data yet — check back once the season data has synced.
      </section>
    );
  }

  return (
    <section className="rounded-2xl bg-gradient-to-br from-pitch-800 to-pitch-600 p-6 text-white shadow-md">
      <p className="text-xs font-semibold uppercase tracking-wide text-white/50">Gameweek {gameweek.id}</p>

      {gameweek.state === "open" ? (
        <>
          <p className="mt-1 text-2xl font-extrabold">
            Locks in <Countdown lockAt={gameweek.lock_at!} />
          </p>
          <div className="mt-4">
            {ownPick ? (
              <p className="text-sm text-white/80">
                You&rsquo;ve picked <span className="font-semibold text-gold-400">{ownPick.player_name}</span>{" "}
                <span className="text-white/50">· {ownPick.team_short_name}</span>
                {ownPick.stake === 6 ? " ×2" : ""}
              </p>
            ) : (
              <Link
                href="/pick"
                className="inline-block rounded-full bg-gold-500 px-5 py-2 text-sm font-semibold text-pitch-900 shadow-sm hover:bg-gold-400"
              >
                Make your pick →
              </Link>
            )}
          </div>
        </>
      ) : gameweek.state === "locked" ? (
        <>
          <p className="mt-1 text-2xl font-extrabold">🔒 Locked — live now</p>
          <p className="mt-2 text-sm text-white/70">
            {ownPick
              ? `You picked ${ownPick.player_name} (${ownPick.team_short_name})${ownPick.stake === 6 ? " ×2" : ""} — ${ownPick.goals} goal${ownPick.goals === 1 ? "" : "s"} so far.`
              : "You didn't pick for this gameweek."}
          </p>
        </>
      ) : (
        <p className="mt-1 text-2xl font-extrabold">📅 Not scheduled yet</p>
      )}
    </section>
  );
}

function FixturesCard({
  fixtures,
  picksByTeam,
}: {
  fixtures: Fixture[];
  picksByTeam: Map<number, RevealedPick[]>;
}) {
  return (
    <section className="rounded-2xl border border-pitch-900/10 bg-white p-5 shadow-sm">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-pitch-900/40">Fixtures</h2>
      {fixtures.length === 0 ? (
        <p className="mt-3 text-sm text-pitch-900/50">No fixtures confirmed yet.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {fixtures.map((f) => {
            const picks = [...(picksByTeam.get(f.team_h) ?? []), ...(picksByTeam.get(f.team_a) ?? [])];
            return (
              <li key={f.id} className="rounded-xl bg-pitch-50 px-3 py-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-pitch-900">
                    {f.home} v {f.away}
                  </span>
                  <span className="text-xs text-pitch-900/40">
                    {f.finished
                      ? "Finished"
                      : f.kickoff_time
                        ? new Date(f.kickoff_time).toLocaleString(undefined, {
                          weekday: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                        : "TBC"}
                  </span>
                </div>
                {picks.length > 0 && (
                  <p className="mt-1 text-xs text-gold-600">
                    {picks.map((p) => `${p.entrant_name}: ${p.player_name}`).join(" · ")}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function NewsCard({
  news,
}: {
  news: { code: number; web_name: string; status: string; news: string; team_short_name: string }[];
}) {
  return (
    <section className="rounded-2xl border border-pitch-900/10 bg-white p-5 shadow-sm">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-pitch-900/40">Injury news</h2>
      {news.length === 0 ? (
        <p className="mt-3 text-sm text-pitch-900/50">No injury news at the moment.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {news.map((p) => (
            <li key={p.code} className="text-sm">
              <span className="font-medium text-pitch-900">{p.web_name}</span>{" "}
              <span className="text-pitch-900/40">({p.team_short_name})</span>
              <p className="text-xs text-gold-600">
                {STATUS_LABEL[p.status] ?? p.status}: {p.news}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RevealCard({ gameweek, picks }: { gameweek: number; picks: RevealedPick[] }) {
  return (
    <section className="rounded-2xl border border-pitch-900/10 bg-white p-5 shadow-sm">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-pitch-900/40">
        Gameweek {gameweek} reveal
      </h2>
      <ul className="mt-3 divide-y divide-pitch-900/5">
        {picks.map((p, i) => (
          <li key={i} className="flex items-center justify-between py-2 text-sm">
            <span className="font-medium text-pitch-900">{p.entrant_name}</span>
            <span>
              {p.player_name} <span className="text-pitch-900/40">({p.team_short_name})</span>
              {p.stake === 6 ? " ×2" : ""}
            </span>
            <span className="tabular-nums text-pitch-900/50">
              {p.goals} goal{p.goals === 1 ? "" : "s"}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

const MEDALS = ["🥇", "🥈", "🥉"];

function StandingsCard({
  rows,
  ownRank,
}: {
  rows: { entrant_id: string; display_name: string; total_points: number; scoring_gameweeks: number }[];
  ownRank: number;
}) {
  if (rows.length === 0) return null;

  return (
    <section className="rounded-2xl border border-pitch-900/10 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-pitch-900/40">Standings</h2>
        <Link href="/leaderboard" className="text-xs font-medium text-pitch-600 hover:underline">
          Full leaderboard →
        </Link>
      </div>
      <ul className="mt-3 flex flex-col gap-1.5">
        {rows.map((row, i) => (
          <li
            key={row.entrant_id}
            className={`flex items-center justify-between rounded-lg px-2 py-1 text-sm ${
              i === ownRank ? "bg-gold-500/15" : ""
            }`}
          >
            <span className="font-medium text-pitch-900">
              {MEDALS[i] ?? "⚽"} {row.display_name}
            </span>
            <span className="tabular-nums text-pitch-700">{row.total_points}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
