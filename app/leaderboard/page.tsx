import { createClient } from "@/lib/supabase/server";
import { getStarCounts } from "@/lib/winners";

export default async function LeaderboardPage() {
  const supabase = await createClient();

  const { data: leaderboard } = await supabase
    .from("leaderboard")
    .select("entrant_id, display_name, total_points, scoring_gameweeks");

  const starCounts = await getStarCounts(supabase);

  // Picks for the most recently locked gameweek. RLS does the actual work
  // here: a still-open gameweek's rows for other entrants simply won't come
  // back, so there's no separate "is it locked yet" branch to get wrong.
  const { data: latestLocked } = await supabase
    .from("gameweeks")
    .select("id")
    .not("lock_at", "is", null)
    .lte("lock_at", new Date().toISOString())
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: revealedPicks } = latestLocked
    ? await supabase
      .from("picks")
      .select("entrant_id, stake, goals, entrants(display_name), players(web_name, teams(short_name))")
      .eq("gameweek", latestLocked.id)
    : { data: null };

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-extrabold text-foreground">Leaderboard</h1>

      <div className="mt-4 overflow-hidden rounded-2xl border border-foreground/10 bg-surface shadow-sm backdrop-blur-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-black/20 text-left text-xs uppercase tracking-wide text-foreground/50">
              <th className="px-4 py-3 font-medium">Entrant</th>
              <th className="px-4 py-3 text-right font-medium">Points</th>
              <th className="px-4 py-3 text-right font-medium">Scoring GWs</th>
            </tr>
          </thead>
          <tbody>
            {(leaderboard ?? []).map((row, i) => (
              <tr key={row.entrant_id} className="border-t border-foreground/5">
                <td className="px-4 py-3 font-medium text-foreground">
                  {i === 0 && "🏆 "}
                  {row.display_name}
                  {(starCounts.get(row.entrant_id) ?? 0) > 0 && (
                    <span
                      className="ml-1"
                      aria-label={`${starCounts.get(row.entrant_id)} title${starCounts.get(row.entrant_id)! > 1 ? "s" : ""}`}
                    >
                      {"⭐".repeat(starCounts.get(row.entrant_id)!)}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-semibold text-gold-400">
                  {row.total_points}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-foreground/50">
                  {row.scoring_gameweeks}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-foreground/40">
        Ties are broken by the most individual gameweeks with a scoring pick.
      </p>

      {latestLocked && (
        <section className="mt-8">
          <h2 className="text-lg font-bold text-foreground">Gameweek {latestLocked.id} picks</h2>
          <div className="mt-3 overflow-hidden rounded-2xl border border-foreground/10 bg-surface shadow-sm backdrop-blur-sm">
            <ul className="divide-y divide-foreground/5">
              {(revealedPicks ?? []).map((p, i) => (
                <li key={i} className="flex items-center justify-between px-4 py-3 text-sm">
                  <span className="font-medium text-foreground">{p.entrants?.display_name}</span>
                  <span className="text-foreground/80">
                    {p.players?.web_name}{" "}
                    <span className="text-foreground/40">({p.players?.teams?.short_name})</span>
                    {p.stake === 6 ? " ×2" : ""}
                  </span>
                  <span className="tabular-nums text-foreground/50">
                    {p.goals} goal{p.goals === 1 ? "" : "s"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </main>
  );
}
