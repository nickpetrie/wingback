import { createClient } from "@/lib/supabase/server";
import { getCurrentGameweek } from "@/lib/gameweek";
import { getCurrentEntrantId } from "@/lib/entrant";
import { getStarCounts } from "@/lib/winners";
import { Header } from "./Header";

export async function Nav() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const entrantId = await getCurrentEntrantId(supabase, user.id);
  if (!entrantId) return null; // unclaimed — middleware sends them to /claim, chrome-free

  const [{ data: leaderboard }, starCounts, gameweek] = await Promise.all([
    supabase.from("leaderboard").select("entrant_id, display_name, total_points"),
    getStarCounts(supabase),
    getCurrentGameweek(supabase),
  ]);

  const standings = (leaderboard ?? []).map((row) => ({
    ...row,
    stars: starCounts.get(row.entrant_id) ?? 0,
  }));

  return <Header gameweek={gameweek} entrantId={entrantId} standings={standings} />;
}
