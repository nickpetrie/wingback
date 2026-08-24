import type { GameweekFixture } from "@/lib/fixtures";
import type { GameweekPick } from "@/lib/picks";

export function GameweekPicksPanel({
  fixtures,
  picks,
}: {
  fixtures: GameweekFixture[];
  picks: GameweekPick[];
}) {
  const picksByTeam = new Map<number, GameweekPick[]>();
  for (const p of picks) {
    picksByTeam.set(p.team_id, [...(picksByTeam.get(p.team_id) ?? []), p]);
  }

  return (
    <div>
      <h2 className="text-xs font-semibold uppercase tracking-wide text-pitch-900/40">Picks so far</h2>
      {fixtures.length === 0 ? (
        <p className="mt-2 text-sm text-pitch-900/50">No fixtures confirmed yet.</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-2">
          {fixtures.map((f) => {
            const inFixture = [...(picksByTeam.get(f.team_h) ?? []), ...(picksByTeam.get(f.team_a) ?? [])];
            return (
              <li key={f.id} className="rounded-xl bg-pitch-50 px-3 py-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-pitch-900">
                    {f.home} v {f.away}
                  </span>
                  <span className="text-xs text-pitch-900/40">
                    {f.finished
                      ? "Finished"
                      : f.kickoff_time
                        ? new Date(f.kickoff_time).toLocaleString(undefined, {
                          weekday: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                        : "TBC"}
                  </span>
                </div>
                {inFixture.length > 0 && (
                  <ul className="mt-1.5 flex flex-col gap-0.5">
                    {inFixture.map((p, i) => (
                      <li key={i} className="flex items-center justify-between text-xs text-pitch-900/70">
                        <span>
                          {p.entrant_name}:{" "}
                          <span className="font-medium text-gold-600">{p.player_name}</span>
                          {p.stake === 6 ? " ×2" : ""}
                        </span>
                        <span className="tabular-nums text-pitch-900/40">
                          {p.goals} goal{p.goals === 1 ? "" : "s"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {picks.length === 0 && fixtures.length > 0 && (
        <p className="mt-2 text-sm text-pitch-900/50">Nobody has picked yet.</p>
      )}
    </div>
  );
}
