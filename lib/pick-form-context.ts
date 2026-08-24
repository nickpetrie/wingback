import type { createClient } from "@/lib/supabase/server";
import { computeUsedCounts, doublesUsed, type PickHistoryEntry } from "@/lib/rules";
import { loadPlayers, type PlayerOption } from "@/lib/players";
import type { Stake } from "@/lib/supabase/types";

export interface PickFormContext {
  players: PlayerOption[];
  usedCounts: Map<number, number>;
  nominationCode: number | null;
  doublesUsedCount: number;
  currentPick: { player_code: number; stake: Stake } | null;
}

/** Everything PickForm needs for a given (entrant, gameweek). Reuse counts
 * exclude this gameweek's own pick — editing/reselecting it isn't a new
 * "use", and picks_guard already excludes the row being updated on the DB
 * side, so the client-side check has to agree or it blocks edits the DB
 * would actually allow. */
export async function getPickFormContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  entrantId: string,
  gameweekId: number,
): Promise<PickFormContext> {
  const [{ data: entrant }, { data: history }, players] = await Promise.all([
    supabase.from("entrants").select("nomination_player_code").eq("id", entrantId).single(),
    supabase.from("picks").select("gameweek, player_code, goals, stake").eq("entrant_id", entrantId),
    loadPlayers(supabase),
  ]);

  const pickHistory: PickHistoryEntry[] = history ?? [];
  const currentPick = pickHistory.find((h) => h.gameweek === gameweekId) ?? null;
  const otherPicks = pickHistory.filter((h) => h.gameweek !== gameweekId);

  return {
    players,
    usedCounts: computeUsedCounts(otherPicks),
    nominationCode: entrant?.nomination_player_code ?? null,
    doublesUsedCount: doublesUsed(otherPicks),
    currentPick: currentPick ? { player_code: currentPick.player_code, stake: currentPick.stake } : null,
  };
}
