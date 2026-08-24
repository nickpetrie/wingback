import type { createClient } from "@/lib/supabase/server";

// The only fields the pick screen needs. bootstrap-static is ~5MB and never
// leaves the server; this is the trimmed shape that actually reaches the
// browser (~600 rows, a few dozen bytes each).
export interface PlayerOption {
  code: number;
  web_name: string;
  full_name: string;
  team_short_name: string;
  element_type: number;
  status: string;
  news: string;
}

export async function loadPlayers(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<PlayerOption[]> {
  const { data: playersRaw } = await supabase
    .from("players")
    .select("code, web_name, first_name, second_name, team_id, element_type, status, news, teams(short_name)")
    .order("web_name");

  return (playersRaw ?? []).map((p) => ({
    code: p.code,
    web_name: p.web_name,
    full_name: `${p.first_name} ${p.second_name}`,
    team_short_name: p.teams?.short_name ?? "",
    element_type: p.element_type,
    status: p.status,
    news: p.news,
  }));
}
