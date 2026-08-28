import type { createClient } from "@/lib/supabase/server";
import { computeUsedCounts, doublesUsed, type PickHistoryEntry } from "@/lib/rules";
import { loadPlayers, loadTeams, type PlayerOption, type TeamOption } from "@/lib/players";
import type { Stake } from "@/lib/supabase/types";

export interface PickFormContext {
  players: PlayerOption[];
  teams: TeamOption[];
  usedCounts: Map<number, number>;
  /** player_code -> the gameweeks it was already spent in, so a locked row
   * can say *when* rather than just "no". */
  usedGameweeks: Map<number, number[]>;
  nominationCode: number | null;
  doublesUsedCount: number;
  currentPick: { player_code: number; stake: Stake } | null;
  playersSyncedAt: string | null;
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
  const [{ data: entrant }, { data: history }, players, teams, { data: syncRow }] =
    await Promise.all([
      supabase.from("entrants").select("nomination_player_code").eq("id", entrantId).single(),
      supabase.from("picks").select("gameweek, player_code, goals, stake").eq("entrant_id", entrantId),
      loadPlayers(supabase),
      loadTeams(supabase),
      supabase.from("sync_state").select("synced_at").eq("source", "players").maybeSingle(),
    ]);

  const pickHistory: PickHistoryEntry[] = history ?? [];
  const currentPick = pickHistory.find((h) => h.gameweek === gameweekId) ?? null;
  const otherPicks = pickHistory.filter((h) => h.gameweek !== gameweekId);

  const usedGameweeks = new Map<number, number[]>();
  for (const h of [...otherPicks].sort((a, b) => a.gameweek - b.gameweek)) {
    usedGameweeks.set(h.player_code, [...(usedGameweeks.get(h.player_code) ?? []), h.gameweek]);
  }

  return {
    players,
    teams,
    usedCounts: computeUsedCounts(otherPicks),
    usedGameweeks,
    nominationCode: entrant?.nomination_player_code ?? null,
    doublesUsedCount: doublesUsed(otherPicks),
    currentPick: currentPick ? { player_code: currentPick.player_code, stake: currentPick.stake } : null,
    playersSyncedAt: syncRow?.synced_at ?? null,
  };
}
