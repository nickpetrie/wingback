import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentGameweek } from "@/lib/gameweek";
import { getCurrentEntrantId } from "@/lib/entrant";
import { getGameweekFixtures } from "@/lib/fixtures";
import { getGameweekPicks, type GameweekPick } from "@/lib/picks";
import { getPickFormContext } from "@/lib/pick-form-context";
import { getStarCounts } from "@/lib/winners";
import { GameweekPicksPanel } from "./GameweekPicksPanel";
import { LockRevealOverlay } from "./LockRevealOverlay";
import { STATUS_LABEL } from "./PlayerSearchInput";
import { Countdown } from "./pick/Countdown";
import { PickForm } from "./pick/PickForm";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const entrantId = await getCurrentEntrantId(supabase, user.id);
  if (!entrantId) return null; // middleware sends anyone without a claim to /claim first

  const gameweek = await getCurrentGameweek(supabase);
  const fixtures = gameweek ? await getGameweekFixtures(supabase, gameweek.id) : [];
  const picks = gameweek ? await getGameweekPicks(supabase, gameweek.id) : [];
  const ownPick = picks.find((p) => p.entrant_id === entrantId) ?? null;
  const pickForm =
    gameweek?.state === "open" ? await getPickFormContext(supabase, entrantId, gameweek.id) : null;

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
  const starCounts = await getStarCounts(supabase);

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      {gameweek?.state === "locked" && (
        <LockRevealOverlay gameweekId={gameweek.id} picks={picks} />
      )}

      <GameweekCard gameweek={gameweek} ownPick={ownPick} />

      {gameweek?.state === "open" && pickForm && (
        <section className="rounded-3xl border border-foreground/10 bg-surface p-5 shadow-sm backdrop-blur-sm sm:p-6">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-foreground/40">
            {pickForm.currentPick ? "Your pick" : "Make your pick"}
          </h2>
          <div className="mt-3">
            <PickForm
              gameweek={gameweek.id}
              players={pickForm.players}
              usedCounts={pickForm.usedCounts}
              nominationCode={pickForm.nominationCode}
              doublesUsedCount={pickForm.doublesUsedCount}
              currentPick={pickForm.currentPick}
            />
          </div>
        </section>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-2xl border border-foreground/10 bg-surface p-5 shadow-sm backdrop-blur-sm">
          <GameweekPicksPanel fixtures={fixtures} picks={picks} />
        </section>
        <NewsCard news={news} />
      </div>

      <StandingsCard rows={rows} ownRank={ownRank} starCounts={starCounts} />
    </main>
  );
}

function GameweekCard({
  gameweek,
  ownPick,
}: {
  gameweek: Awaited<ReturnType<typeof getCurrentGameweek>>;
  ownPick: GameweekPick | null;
}) {
  if (!gameweek) {
    return (
      <section className="rounded-3xl border border-dashed border-foreground/15 bg-surface p-6 text-center text-sm text-foreground/60">
        No gameweek data yet — check back once the season data has synced.
      </section>
    );
  }

  return (
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-pitch-800 via-pitch-700 to-pitch-900 p-6 text-white shadow-lg sm:p-8">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-gold-500/20 blur-3xl"
      />
      <p className="relative text-xs font-semibold uppercase tracking-[0.2em] text-gold-400/80">
        Gameweek {gameweek.id}
      </p>

      {gameweek.state === "open" ? (
        <>
          <p className="relative mt-3 text-6xl font-extrabold tracking-tight tabular-nums sm:text-7xl">
            <Countdown lockAt={gameweek.lock_at!} />
          </p>
          <p className="relative mt-2 text-sm font-medium uppercase tracking-wide text-white/50">
            until picks lock
          </p>
        </>
      ) : gameweek.state === "locked" ? (
        <>
          <p className="relative mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">🔒 Live now</p>
          <p className="relative mt-2 text-sm text-white/70">
            {ownPick
              ? `You picked ${ownPick.player_name} (${ownPick.team_short_name})${ownPick.stake === 6 ? " ×2" : ""} — ${ownPick.goals} goal${ownPick.goals === 1 ? "" : "s"} so far.`
              : "You didn't pick for this gameweek."}
          </p>
        </>
      ) : (
        <p className="relative mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">📅 Not scheduled yet</p>
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
    <section className="rounded-2xl border border-foreground/10 bg-surface p-5 shadow-sm backdrop-blur-sm">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-foreground/40">Injury news</h2>
      {news.length === 0 ? (
        <p className="mt-3 text-sm text-foreground/50">No injury news at the moment.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {news.map((p) => (
            <li key={p.code} className="text-sm">
              <span className="font-medium text-foreground">{p.web_name}</span>{" "}
              <span className="text-foreground/40">({p.team_short_name})</span>
              <p className="text-xs text-gold-400">
                {STATUS_LABEL[p.status] ?? p.status}: {p.news}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const MEDALS = ["🥇", "🥈", "🥉"];

function StandingsCard({
  rows,
  ownRank,
  starCounts,
}: {
  rows: { entrant_id: string; display_name: string; total_points: number; scoring_gameweeks: number }[];
  ownRank: number;
  starCounts: Map<string, number>;
}) {
  if (rows.length === 0) return null;

  return (
    <section className="rounded-2xl border border-foreground/10 bg-surface p-5 shadow-sm backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-foreground/40">Standings</h2>
        <Link href="/leaderboard" className="text-xs font-medium text-gold-400 hover:underline">
          Full leaderboard →
        </Link>
      </div>
      <ul className="mt-3 flex flex-col gap-1.5">
        {rows.map((row, i) => {
          const stars = starCounts.get(row.entrant_id) ?? 0;
          return (
            <li
              key={row.entrant_id}
              className={`flex items-center justify-between rounded-lg px-2 py-1 text-sm ${
                i === ownRank ? "bg-gold-500/15" : ""
              }`}
            >
              <span className="font-medium text-foreground">
                {MEDALS[i] ?? "⚽"} {row.display_name}
                {stars > 0 && (
                  <span className="ml-1" aria-label={`${stars} title${stars > 1 ? "s" : ""}`}>
                    {"⭐".repeat(stars)}
                  </span>
                )}
              </span>
              <span className="tabular-nums text-gold-400">{row.total_points}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
