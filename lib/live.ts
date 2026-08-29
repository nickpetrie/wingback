// Is a fixture being played *right now*?
//
// Three sources disagree about this and each is wrong on its own:
//
//   - `started` and `minutes` are mirrored from FPL by `score`, which runs
//     every ten minutes while a gameweek is live. So `started` can be up to
//     ten minutes behind a kickoff — long enough that a badge waiting on it
//     appears after the first goal.
//   - The clock alone doesn't know about a postponement, and would light up
//     a match that never began.
//   - `finished` is not flipped at full time (see CLAUDE.md), which is why
//     `played` exists and is the only thing here trusted to end a match.
//
// So: `played` ends it, `started` *or* the kickoff passing begins it, and a
// hard cap stops a page nobody reloads showing LIVE for the rest of the week.

export interface LiveFixture {
  kickoff_time: string | null;
  started: boolean;
  played: boolean;
}

/** 90 minutes, half-time, and enough stoppage for the worst Saturday. Past
 * this we stop claiming a match is live even if nothing has told us it ended:
 * being wrong for twenty minutes beats being wrong until Thursday. */
export const MAX_MATCH_MS = 150 * 60 * 1000;

/** While something is live the page is worth re-checking often — that is when
 * goals land — but not so often that five phones make a poller out of it. */
export const LIVE_RECHECK_MS = 60 * 1000;

export function isFixtureLive(fixture: LiveFixture, now: number): boolean {
  if (fixture.played) return false;

  const kickoff = fixture.kickoff_time ? Date.parse(fixture.kickoff_time) : NaN;
  if (Number.isNaN(kickoff)) return false;

  // `started` wins over the clock in both directions: it lights a match up
  // that kicked off early, and it is the reason a fixture whose time has come
  // and gone is only live until the cap runs out.
  const begun = fixture.started || now >= kickoff;
  if (!begun) return false;

  return now - kickoff < MAX_MATCH_MS;
}

/** The moment this page's answer could next change: a minute away while
 * anything is live, otherwise the next kickoff, otherwise never. Returning
 * the moment rather than a boolean is what lets the client sleep through a
 * quiet Tuesday instead of polling across it. */
export function nextLiveChangeAt(fixtures: LiveFixture[], now: number): number | null {
  if (fixtures.some((f) => isFixtureLive(f, now))) return now + LIVE_RECHECK_MS;

  let soonest: number | null = null;
  for (const fixture of fixtures) {
    if (fixture.played || !fixture.kickoff_time) continue;
    const kickoff = Date.parse(fixture.kickoff_time);
    if (Number.isNaN(kickoff) || kickoff <= now) continue;
    if (soonest === null || kickoff < soonest) soonest = kickoff;
  }
  return soonest;
}

export interface LiveState {
  /** Clubs with a match in progress — the picks to badge. */
  liveTeamIds: Set<number>;
  nextChangeAt: number | null;
}

/** Everything a page needs to render liveness, from one read of the clock.
 *
 * Here rather than inlined in the page because reading the clock inside a
 * component is impure — React's compiler rejects it, and rightly: two reads
 * in one render could disagree about whether a match had started. `now` is a
 * parameter only so tests can pin it. */
export function liveState(
  fixtures: (LiveFixture & { team_h: number; team_a: number })[],
  now: number = Date.now(),
): LiveState {
  const liveTeamIds = new Set<number>();
  for (const fixture of fixtures) {
    if (!isFixtureLive(fixture, now)) continue;
    liveTeamIds.add(fixture.team_h);
    liveTeamIds.add(fixture.team_a);
  }
  return { liveTeamIds, nextChangeAt: nextLiveChangeAt(fixtures, now) };
}
