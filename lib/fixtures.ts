import type { createClient } from "@/lib/supabase/server";

export interface GameweekFixture {
  id: number;
  kickoff_time: string | null;
  finished: boolean;
  team_h: number;
  team_a: number;
  home: string;
  away: string;
}

export async function getGameweekFixtures(
  supabase: Awaited<ReturnType<typeof createClient>>,
  gameweekId: number,
): Promise<GameweekFixture[]> {
  const { data } = await supabase
    .from("fixtures")
    .select(
      "id, kickoff_time, finished, team_h, team_a, home:teams!fixtures_team_h_fkey(short_name), away:teams!fixtures_team_a_fkey(short_name)",
    )
    .eq("event", gameweekId)
    .order("kickoff_time", { ascending: true });

  return (data ?? []).map((f) => ({
    id: f.id,
    kickoff_time: f.kickoff_time,
    finished: f.finished,
    team_h: f.team_h,
    team_a: f.team_a,
    home: f.home?.short_name ?? "?",
    away: f.away?.short_name ?? "?",
  }));
}
