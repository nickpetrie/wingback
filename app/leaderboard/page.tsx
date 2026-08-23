import { createClient } from "@/lib/supabase/server";

export default async function LeaderboardPage() {
  const supabase = await createClient();

  const { data: leaderboard } = await supabase
    .from("leaderboard")
    .select("entrant_id, display_name, total_points, scoring_gameweeks");

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
      <h1 className="text-xl font-bold">Leaderboard</h1>

      <table className="mt-4 w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-200 text-left text-neutral-500">
            <th className="py-2">Entrant</th>
            <th className="py-2 text-right">Points</th>
            <th className="py-2 text-right">Scoring GWs</th>
          </tr>
        </thead>
        <tbody>
          {(leaderboard ?? []).map((row, i) => (
            <tr key={row.entrant_id} className="border-b border-neutral-100">
              <td className="py-2 font-medium">
                {i === 0 && "🏆 "}
                {row.display_name}
              </td>
              <td className="py-2 text-right tabular-nums">{row.total_points}</td>
              <td className="py-2 text-right tabular-nums">{row.scoring_gameweeks}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-neutral-400">
        Ties are broken by the most individual gameweeks with a scoring pick.
      </p>

      {latestLocked && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">Gameweek {latestLocked.id} picks</h2>
          <ul className="mt-3 divide-y divide-neutral-100">
            {(revealedPicks ?? []).map((p, i) => (
              <li key={i} className="flex items-center justify-between py-2 text-sm">
                <span className="font-medium">{p.entrants?.display_name}</span>
                <span>
                  {p.players?.web_name} <span className="text-neutral-400">({p.players?.teams?.short_name})</span>
                  {p.stake === 6 ? " ×2" : ""}
                </span>
                <span className="tabular-nums text-neutral-500">{p.goals} goal{p.goals === 1 ? "" : "s"}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
