import type { createClient } from "@/lib/supabase/server";

// The only fields the pick screen needs. bootstrap-static is ~5MB and never
// leaves the server; this is the trimmed shape that actually reaches the
// browser (~600 rows, a few dozen bytes each) — which is also what lets the
// search and the team browser filter in memory instead of hitting the
// network on every keystroke.
export interface PlayerOption {
  code: number;
  web_name: string;
  full_name: string;
  team_id: number;
  team_name: string;
  team_short_name: string;
  team_code: number | null;
  element_type: number;
  status: string;
  news: string;
  // null means "not synced yet", not zero. See
  // 20260101000020_player_season_stats.sql.
  goals: number | null;
  assists: number | null;
  starts: number | null;
}

export interface TeamOption {
  id: number;
  name: string;
  short_name: string;
  code: number | null;
}

const POSITIONS: Record<number, string> = { 1: "GKP", 2: "DEF", 3: "MID", 4: "FWD" };

export function positionLabel(elementType: number): string {
  return POSITIONS[elementType] ?? "—";
}

export async function loadPlayers(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<PlayerOption[]> {
  const { data: playersRaw } = await supabase
    .from("players")
    .select(
      "code, web_name, first_name, second_name, team_id, element_type, status, news, goals_scored, assists, starts, teams(name, short_name, code)",
    )
    .order("web_name");

  return (playersRaw ?? []).map((p) => ({
    code: p.code,
    web_name: p.web_name,
    full_name: `${p.first_name} ${p.second_name}`,
    team_id: p.team_id,
    team_name: p.teams?.name ?? "",
    team_short_name: p.teams?.short_name ?? "",
    team_code: p.teams?.code ?? null,
    element_type: p.element_type,
    status: p.status,
    news: p.news,
    goals: p.goals_scored,
    assists: p.assists,
    starts: p.starts,
  }));
}

export async function loadTeams(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<TeamOption[]> {
  const { data } = await supabase
    .from("teams")
    .select("id, name, short_name, code")
    .order("name");
  return data ?? [];
}
