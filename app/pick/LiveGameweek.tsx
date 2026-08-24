interface Fixture {
  id: number;
  kickoff_time: string | null;
  finished: boolean;
  home: string;
  away: string;
}

interface RevealedPick {
  entrant_name: string;
  player_name: string;
  team_short_name: string;
  stake: 3 | 6;
  goals: number;
}

export function LiveGameweek({
  gameweekId,
  fixtures,
  ownPick,
  revealedPicks,
}: {
  gameweekId: number;
  fixtures: Fixture[];
  ownPick: { player_name: string; team_short_name: string; stake: 3 | 6; goals: number } | null;
  revealedPicks: RevealedPick[];
}) {
  return (
    <div className="mt-4 flex flex-col gap-6">
      <p className="rounded-full bg-pitch-50 px-4 py-2 text-sm text-pitch-900/70">
        Gameweek {gameweekId} has locked — picks are visible below. Come back once it finishes for
        the next one to open.
      </p>

      {ownPick ? (
        <div className="rounded-2xl border border-pitch-900/10 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-pitch-900/40">Your pick</p>
          <p className="mt-1 font-semibold text-pitch-900">
            {ownPick.player_name} <span className="font-normal text-pitch-900/40">· {ownPick.team_short_name}</span>
            {ownPick.stake === 6 ? " ×2" : ""}
          </p>
          <p className="text-sm text-pitch-900/50">
            {ownPick.goals} goal{ownPick.goals === 1 ? "" : "s"} so far
          </p>
        </div>
      ) : (
        <p className="rounded-full bg-gold-500/15 px-4 py-2 text-sm text-gold-600">
          You didn&rsquo;t pick for this gameweek.
        </p>
      )}

      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-pitch-900/40">Fixtures</h2>
        <div className="mt-2 overflow-hidden rounded-2xl border border-pitch-900/10 bg-white shadow-sm">
          <ul className="divide-y divide-pitch-900/5">
            {fixtures.map((f) => (
              <li key={f.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="font-medium text-pitch-900">
                  {f.home} v {f.away}
                </span>
                <span className="text-pitch-900/40">
                  {f.finished
                    ? "Finished"
                    : f.kickoff_time
                      ? new Date(f.kickoff_time).toLocaleString()
                      : "TBC"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {revealedPicks.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-pitch-900/40">
            Everyone&rsquo;s picks
          </h2>
          <div className="mt-2 overflow-hidden rounded-2xl border border-pitch-900/10 bg-white shadow-sm">
            <ul className="divide-y divide-pitch-900/5">
              {revealedPicks.map((p, i) => (
                <li key={i} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="font-medium text-pitch-900">{p.entrant_name}</span>
                  <span>
                    {p.player_name} <span className="text-pitch-900/40">({p.team_short_name})</span>
                    {p.stake === 6 ? " ×2" : ""}
                  </span>
                  <span className="tabular-nums text-pitch-900/50">
                    {p.goals} goal{p.goals === 1 ? "" : "s"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
