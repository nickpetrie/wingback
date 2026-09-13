// End-of-season awards, derived the same way lib/prize.ts derives the pot:
// computed from picks that already exist, never stored, so there's nothing
// here that can drift from `goals` the way a cached total could. See
// CLAUDE.md — "Points are never stored" applies just as much to a title as
// it does to a leaderboard number.

export interface AwardPick {
  entrantId: string;
  gameweek: number;
  playerCode: number;
  stake: 3 | 6;
  goals: number;
  /** Straight from the `pick_scores` view, which is where every other points
   * number in the app comes from. Deliberately not recomputed here: the view
   * also applies the double-gameweek penalty, so a third implementation of
   * the scoring rule would have quietly disagreed with the table for anyone
   * who took a penalised double. */
  points: number;
  createdAt: string;
}

export interface AwardGameweek {
  id: number;
  finished: boolean;
  lockAt: string | null;
}

export interface AwardResult {
  /** Entrant ids. More than one on a tie — ties are reported, never broken
   * arbitrarily. Empty when nobody qualifies (e.g. nobody ever had an
   * exclusive pick that scored). */
  winners: string[];
  value: number;
}

export interface SeasonAwards {
  vulture: AwardResult;
  sheep: AwardResult;
  nostradamus: AwardResult;
  iceCold: AwardResult;
  cautious: AwardResult;
  deadlineDan: AwardResult;
}

/** The owner wants these to kick in once the season is over, not partway —
 * a mid-season "longest run" or "most exclusive picks" would just describe
 * whoever happens to be ahead right now, and reads as a verdict the season
 * hasn't reached yet. So the whole section is gated on every gameweek having
 * finished, not just the ones with picks in them. */
export function isSeasonComplete(gameweeks: AwardGameweek[], totalGameweeks = 38): boolean {
  return gameweeks.length >= totalGameweeks && gameweeks.every((g) => g.finished);
}

function winnersFromTotals(totals: Map<string, number>): AwardResult {
  let max = 0;
  for (const value of totals.values()) max = Math.max(max, value);
  if (max <= 0) return { winners: [], value: 0 };
  const winners = [...totals.entries()].filter(([, v]) => v === max).map(([id]) => id);
  winners.sort();
  return { winners, value: max };
}

function sumByEntrant(
  picks: AwardPick[],
  settled: Set<number>,
  valueFor: (pick: AwardPick) => number,
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const pick of picks) {
    if (!settled.has(pick.gameweek)) continue;
    const value = valueFor(pick);
    if (value === 0) continue;
    totals.set(pick.entrantId, (totals.get(pick.entrantId) ?? 0) + value);
  }
  return totals;
}

/** Longest run of consecutive settled gameweeks where `qualifies` holds for
 * that entrant's pick. A gameweek the entrant didn't pick in breaks the run
 * (they didn't blank, they didn't play) — same as a gap in the settled
 * gameweek sequence itself, which is why both are handled by the same reset
 * rather than treating "no pick" and "gameweek not reached yet" differently. */
function longestRun(
  picks: AwardPick[],
  settledIdsSorted: number[],
  qualifies: (pick: AwardPick) => boolean,
): AwardResult {
  const byEntrantGw = new Map<string, Map<number, AwardPick>>();
  const entrantIds = new Set<string>();
  for (const pick of picks) {
    entrantIds.add(pick.entrantId);
    if (!byEntrantGw.has(pick.entrantId)) byEntrantGw.set(pick.entrantId, new Map());
    byEntrantGw.get(pick.entrantId)!.set(pick.gameweek, pick);
  }

  const current = new Map<string, number>();
  const best = new Map<string, number>();
  let prevGwId: number | null = null;

  for (const gwId of settledIdsSorted) {
    const gap = prevGwId !== null && gwId !== prevGwId + 1;
    for (const entrantId of entrantIds) {
      if (gap) current.set(entrantId, 0);
      const pick = byEntrantGw.get(entrantId)?.get(gwId);
      if (pick && qualifies(pick)) {
        const next = (current.get(entrantId) ?? 0) + 1;
        current.set(entrantId, next);
        best.set(entrantId, Math.max(best.get(entrantId) ?? 0, next));
      } else {
        current.set(entrantId, 0);
      }
    }
    prevGwId = gwId;
  }

  return winnersFromTotals(best);
}

const MS_PER_HOUR = 60 * 60 * 1000;

export function computeSeasonAwards(
  picks: AwardPick[],
  gameweeks: AwardGameweek[],
  totalGameweeks = 38,
): SeasonAwards | null {
  if (!isSeasonComplete(gameweeks, totalGameweeks)) return null;

  const settled = new Set(gameweeks.filter((g) => g.finished).map((g) => g.id));
  const settledIdsSorted = [...settled].sort((a, b) => a - b);
  const lockAtByGw = new Map(gameweeks.map((g) => [g.id, g.lockAt]));

  // Grouped by (gameweek, player) so the exclusivity the Vulture and the
  // Sheep both key off is computed once rather than twice.
  const groups = new Map<string, AwardPick[]>();
  for (const pick of picks) {
    if (!settled.has(pick.gameweek)) continue;
    const key = `${pick.gameweek}:${pick.playerCode}`;
    const group = groups.get(key);
    if (group) group.push(pick);
    else groups.set(key, [pick]);
  }

  const vultureTotals = new Map<string, number>();
  const sheepTotals = new Map<string, number>();
  for (const group of groups.values()) {
    if (group.length === 1) {
      const [pick] = group;
      const points = pick.points;
      if (points > 0) vultureTotals.set(pick.entrantId, (vultureTotals.get(pick.entrantId) ?? 0) + points);
    } else {
      for (const pick of group) {
        sheepTotals.set(pick.entrantId, (sheepTotals.get(pick.entrantId) ?? 0) + 1);
      }
    }
  }

  const cautiousTotals = sumByEntrant(picks, settled, (p) => (p.stake === 3 ? p.points : 0));

  const deadlineTotals = sumByEntrant(picks, settled, (p) => {
    const lockAt = lockAtByGw.get(p.gameweek);
    if (!lockAt) return 0;
    const lockMs = Date.parse(lockAt);
    const createdMs = Date.parse(p.createdAt);
    return createdMs <= lockMs && lockMs - createdMs <= MS_PER_HOUR ? 1 : 0;
  });

  return {
    vulture: winnersFromTotals(vultureTotals),
    sheep: winnersFromTotals(sheepTotals),
    nostradamus: longestRun(picks, settledIdsSorted, (p) => p.goals > 0),
    iceCold: longestRun(picks, settledIdsSorted, (p) => p.goals === 0),
    cautious: winnersFromTotals(cautiousTotals),
    deadlineDan: winnersFromTotals(deadlineTotals),
  };
}
