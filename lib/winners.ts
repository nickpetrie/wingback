import type { createClient } from "@/lib/supabase/server";

/** One star per season won, World Cup shirt-star style — not a boolean
 * "has ever won", so multiple titles actually stack. */
export async function getStarCounts(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<Map<string, number>> {
  const { data } = await supabase.from("season_winners").select("entrant_id");
  const counts = new Map<string, number>();
  for (const w of data ?? []) {
    counts.set(w.entrant_id, (counts.get(w.entrant_id) ?? 0) + 1);
  }
  return counts;
}
