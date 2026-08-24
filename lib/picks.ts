import type { createClient } from "@/lib/supabase/server";
import type { Stake } from "@/lib/supabase/types";

export interface GameweekPick {
  entrant_id: string;
  entrant_name: string;
  player_code: number;
  player_name: string;
  team_id: number;
  team_short_name: string;
  team_code: number | null;
  stake: Stake;
  goals: number;
}

/** Every pick made for a gameweek so far, across all entrants — picks are
 * visible to everyone as soon as they're made, not just after lock (see
 * CLAUDE.md: this was a deliberate call to match how the old spreadsheet
 * worked, not an oversight). */
export async function getGameweekPicks(
  supabase: Awaited<ReturnType<typeof createClient>>,
  gameweekId: number,
): Promise<GameweekPick[]> {
  const { data } = await supabase
    .from("picks")
    .select(
      "entrant_id, player_code, stake, goals, entrants(display_name), players(web_name, team_id, teams(short_name, code))",
    )
    .eq("gameweek", gameweekId);

  return (data ?? [])
    .filter((p) => p.entrants && p.players)
    .map((p) => ({
      entrant_id: p.entrant_id,
      entrant_name: p.entrants!.display_name,
      player_code: p.player_code,
      player_name: p.players!.web_name,
      team_id: p.players!.team_id,
      team_short_name: p.players!.teams?.short_name ?? "",
      team_code: p.players!.teams?.code ?? null,
      stake: p.stake,
      goals: p.goals,
    }));
}
