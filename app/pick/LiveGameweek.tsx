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
      <p className="rounded-md bg-neutral-100 px-3 py-2 text-sm text-neutral-700">
        Gameweek {gameweekId} has locked — picks are visible below. Come back once it finishes for
        the next one to open.
      </p>

      {ownPick ? (
        <div className="rounded-md border border-neutral-200 p-4">
          <p className="text-sm text-neutral-500">Your pick</p>
          <p className="font-medium">
            {ownPick.player_name} <span className="text-neutral-400">· {ownPick.team_short_name}</span>
            {ownPick.stake === 6 ? " ×2" : ""}
          </p>
          <p className="text-sm text-neutral-500">
            {ownPick.goals} goal{ownPick.goals === 1 ? "" : "s"} so far
          </p>
        </div>
      ) : (
        <p className="text-sm text-amber-700">You didn&rsquo;t pick for this gameweek.</p>
      )}

      <div>
        <h2 className="text-sm font-semibold text-neutral-500">Fixtures</h2>
        <ul className="mt-2 divide-y divide-neutral-100">
          {fixtures.map((f) => (
            <li key={f.id} className="flex items-center justify-between py-2 text-sm">
              <span>
                {f.home} v {f.away}
              </span>
              <span className="text-neutral-400">
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

      {revealedPicks.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-neutral-500">Everyone&rsquo;s picks</h2>
          <ul className="mt-2 divide-y divide-neutral-100">
            {revealedPicks.map((p, i) => (
              <li key={i} className="flex items-center justify-between py-2 text-sm">
                <span className="font-medium">{p.entrant_name}</span>
                <span>
                  {p.player_name} <span className="text-neutral-400">({p.team_short_name})</span>
                  {p.stake === 6 ? " ×2" : ""}
                </span>
                <span className="tabular-nums text-neutral-500">
                  {p.goals} goal{p.goals === 1 ? "" : "s"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
