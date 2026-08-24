import { createClient } from "@/lib/supabase/server";
import { computeUsedCounts, doublesUsed, type PickHistoryEntry } from "@/lib/rules";
import { loadPlayers } from "@/lib/players";
import { Countdown } from "./Countdown";
import { PickForm } from "./PickForm";
import { LiveGameweek } from "./LiveGameweek";

export default async function PickPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null; // middleware already redirects signed-out visitors

  const { data: entrant } = await supabase
    .from("entrants")
    .select("nomination_player_code")
    .eq("id", user.id)
    .single();

  // The next gameweek that hasn't locked yet, if there is one.
  const { data: openGameweek } = await supabase
    .from("gameweeks")
    .select("id, lock_at")
    .eq("finished", false)
    .not("lock_at", "is", null)
    .gt("lock_at", new Date().toISOString())
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle();

  // Otherwise, whichever not-yet-finished gameweek is earliest is the
  // current one — worth showing even though there's no pick form for it.
  // Two different reasons it can land here: it's genuinely locked/live
  // (fixtures kicked off), or FPL just hasn't confirmed its fixture times
  // yet (international breaks, early-season gaps) — lock_at is null either
  // way that happens, so distinguish on that rather than assuming "locked".
  const { data: fallbackGameweek } = openGameweek
    ? { data: null }
    : await supabase
      .from("gameweeks")
      .select("id, lock_at")
      .eq("finished", false)
      .order("id", { ascending: true })
      .limit(1)
      .maybeSingle();

  const gameweek = openGameweek ?? fallbackGameweek;
  const isLocked =
    !openGameweek &&
    !!fallbackGameweek?.lock_at &&
    new Date(fallbackGameweek.lock_at) <= new Date();

  const { data: doubleTeams } = gameweek
    ? await supabase.from("double_gameweek_teams").select("team").eq("event", gameweek.id)
    : { data: null };

  const { data: history } = await supabase
    .from("picks")
    .select("gameweek, player_code, goals, stake")
    .eq("entrant_id", user.id);

  const pickHistory: PickHistoryEntry[] = history ?? [];
  const usedCounts = computeUsedCounts(pickHistory);
  const currentPick = gameweek
    ? pickHistory.find((h) => h.gameweek === gameweek.id) ?? null
    : null;

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-2xl font-extrabold text-pitch-900">Your pick</h1>

      {!gameweek ? (
        <EmptyState>No gameweek data yet — check back once the season data has synced.</EmptyState>
      ) : openGameweek ? (
        <>
          <p className="mt-1 text-sm text-pitch-900/60">
            Gameweek {gameweek.id} locks in{" "}
            <span className="font-semibold text-pitch-700">
              <Countdown lockAt={gameweek.lock_at!} />
            </span>
          </p>
          {doubleTeams && doubleTeams.length > 0 && (
            <p className="mt-2 rounded-full bg-gold-500/15 px-4 py-2 text-sm font-medium text-gold-600">
              ⭐ Double gameweek — {doubleTeams.length} team{doubleTeams.length > 1 ? "s" : ""} play twice.
            </p>
          )}

          <div className="mt-4">
            <PickForm
              gameweek={gameweek.id}
              players={await loadPlayers(supabase)}
              usedCounts={usedCounts}
              nominationCode={entrant?.nomination_player_code ?? null}
              doublesUsedCount={doublesUsed(pickHistory)}
              currentPick={
                currentPick ? { player_code: currentPick.player_code, stake: currentPick.stake } : null
              }
            />
          </div>
        </>
      ) : isLocked ? (
        <LiveGameweekSection
          supabase={supabase}
          gameweekId={gameweek.id}
          userId={user.id}
          currentPick={currentPick}
        />
      ) : (
        <EmptyState>
          Gameweek {gameweek.id} isn&rsquo;t scheduled yet — could be an international break, could just
          be early. Check back once fixtures are confirmed.
        </EmptyState>
      )}
    </main>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 rounded-2xl border border-dashed border-pitch-900/15 bg-pitch-50 p-6 text-center text-sm text-pitch-900/60">
      {children}
    </div>
  );
}

async function LiveGameweekSection({
  supabase,
  gameweekId,
  userId,
  currentPick,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  gameweekId: number;
  userId: string;
  currentPick: PickHistoryEntry | null;
}) {
  const { data: fixturesRaw } = await supabase
    .from("fixtures")
    .select("id, kickoff_time, finished, home:teams!fixtures_team_h_fkey(short_name), away:teams!fixtures_team_a_fkey(short_name)")
    .eq("event", gameweekId)
    .order("kickoff_time", { ascending: true });

  const fixtures = (fixturesRaw ?? []).map((f) => ({
    id: f.id,
    kickoff_time: f.kickoff_time,
    finished: f.finished,
    home: f.home?.short_name ?? "?",
    away: f.away?.short_name ?? "?",
  }));

  const { data: ownPickRaw } = currentPick
    ? await supabase
      .from("picks")
      .select("stake, goals, players(web_name, teams(short_name))")
      .eq("entrant_id", userId)
      .eq("gameweek", gameweekId)
      .maybeSingle()
    : { data: null };

  const ownPick = ownPickRaw?.players
    ? {
      player_name: ownPickRaw.players.web_name,
      team_short_name: ownPickRaw.players.teams?.short_name ?? "",
      stake: ownPickRaw.stake,
      goals: ownPickRaw.goals,
    }
    : null;

  const { data: revealedRaw } = await supabase
    .from("picks")
    .select("stake, goals, entrants(display_name), players(web_name, teams(short_name))")
    .eq("gameweek", gameweekId);

  const revealedPicks = (revealedRaw ?? [])
    .filter((p) => p.entrants && p.players)
    .map((p) => ({
      entrant_name: p.entrants!.display_name,
      player_name: p.players!.web_name,
      team_short_name: p.players!.teams?.short_name ?? "",
      stake: p.stake,
      goals: p.goals,
    }));

  return (
    <LiveGameweek
      gameweekId={gameweekId}
      fixtures={fixtures}
      ownPick={ownPick}
      revealedPicks={revealedPicks}
    />
  );
}
