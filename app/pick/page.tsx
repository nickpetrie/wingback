import { createClient } from "@/lib/supabase/server";
import { computeUsedCounts, doublesUsed, type PickHistoryEntry } from "@/lib/rules";
import type { PlayerOption } from "@/lib/players";
import { Countdown } from "./Countdown";
import { PickForm } from "./PickForm";

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

  // The next gameweek that hasn't locked yet.
  const { data: gameweek } = await supabase
    .from("gameweeks")
    .select("id, lock_at")
    .eq("finished", false)
    .not("lock_at", "is", null)
    .gt("lock_at", new Date().toISOString())
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle();

  const { data: doubleTeams } = gameweek
    ? await supabase.from("double_gameweek_teams").select("team").eq("event", gameweek.id)
    : { data: null };

  const { data: playersRaw } = await supabase
    .from("players")
    .select("code, web_name, first_name, second_name, team_id, element_type, status, news, teams(short_name)")
    .order("web_name");

  const players: PlayerOption[] = (playersRaw ?? []).map((p) => ({
    code: p.code,
    web_name: p.web_name,
    full_name: `${p.first_name} ${p.second_name}`,
    team_short_name: p.teams?.short_name ?? "",
    element_type: p.element_type,
    status: p.status,
    news: p.news,
  }));

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
      <h1 className="text-xl font-bold">Your pick</h1>

      {!gameweek ? (
        <p className="mt-4 text-sm text-neutral-500">No open gameweek right now.</p>
      ) : (
        <>
          <p className="mt-1 text-sm text-neutral-500">
            Gameweek {gameweek.id} locks in <Countdown lockAt={gameweek.lock_at!} />
          </p>
          {doubleTeams && doubleTeams.length > 0 && (
            <p className="mt-2 rounded-md bg-indigo-50 px-3 py-2 text-sm text-indigo-800">
              Double gameweek — {doubleTeams.length} team{doubleTeams.length > 1 ? "s" : ""} play twice.
            </p>
          )}

          <div className="mt-4">
            <PickForm
              gameweek={gameweek.id}
              players={players}
              usedCounts={usedCounts}
              nominationCode={entrant?.nomination_player_code ?? null}
              doublesUsedCount={doublesUsed(pickHistory)}
              currentPick={
                currentPick ? { player_code: currentPick.player_code, stake: currentPick.stake } : null
              }
            />
          </div>
        </>
      )}
    </main>
  );
}
