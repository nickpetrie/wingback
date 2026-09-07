import { describe, expect, it } from "vitest";
import {
  RUNNER_UP_SHARE_PCT,
  SHARED_POT_SHARE_PCT,
  WINNER_SHARE_PCT,
  computePrizeBreakdown,
  type PrizePick,
} from "./prize";

describe("prize shares", () => {
  it("sum to 100", () => {
    expect(WINNER_SHARE_PCT + RUNNER_UP_SHARE_PCT + SHARED_POT_SHARE_PCT).toBe(100);
  });
});

describe("computePrizeBreakdown", () => {
  it("splits £60 into £36 / £15 / £9, £1.80 each, for three locked gameweeks", () => {
    // Five entrants, three locked gameweeks: £3 in GW1 and GW2, £6 (everyone
    // doubled) in GW3 — (5×£3) + (5×£3) + (5×£6) = £60.
    const forGameweek = (gameweek: number, stake: 3 | 6, count = 5): PrizePick[] =>
      Array.from({ length: count }, () => ({ gameweek, stake }));
    const picks: PrizePick[] = [...forGameweek(1, 3), ...forGameweek(2, 3), ...forGameweek(3, 6)];

    const breakdown = computePrizeBreakdown(5, [1, 2, 3], picks);

    expect(breakdown.pot).toBe(60);
    expect(breakdown.winnerShare).toBe(36);
    expect(breakdown.runnerUpShare).toBe(15);
    expect(breakdown.sharedPotShare).toBe(9);
    expect(breakdown.sharedPotPerEntrant).toBe(1.8);
    expect(breakdown.winnerShare + breakdown.runnerUpShare + breakdown.sharedPotShare).toBe(breakdown.pot);
  });

  it("still charges a non-picker their £3 for a locked gameweek", () => {
    // Gameweek 1: only two of five picked, and all five paid — the owner
    // confirmed this is a rule, not a bug.
    const picks: PrizePick[] = [
      { gameweek: 1, stake: 3 },
      { gameweek: 1, stake: 3 },
    ];

    const breakdown = computePrizeBreakdown(5, [1], picks);

    expect(breakdown.pot).toBe(15);
  });

  it("does not count an open gameweek even if a pick already exists for it", () => {
    const picks: PrizePick[] = [{ gameweek: 2, stake: 6 }];

    const breakdown = computePrizeBreakdown(5, [1], picks);

    expect(breakdown.pot).toBe(15);
    expect(breakdown.lockedGameweeks).toBe(1);
  });

  it("returns an empty pot when nothing has locked yet", () => {
    const breakdown = computePrizeBreakdown(5, [], []);

    expect(breakdown.pot).toBe(0);
    expect(breakdown.winnerShare).toBe(0);
    expect(breakdown.runnerUpShare).toBe(0);
    expect(breakdown.sharedPotShare).toBe(0);
    expect(breakdown.sharedPotPerEntrant).toBe(0);
  });

  it("always adds the three shares back up to the pot, whatever the size", () => {
    // The pot is always a multiple of £3 (everyone owes £3 or £6 per locked
    // gameweek), so 60/25/15 happens to land on a whole penny every time —
    // but the shared pot is still computed as a remainder rather than its
    // own rounded percentage, so this holds even if that stops being true.
    for (const [entrants, lockedCount] of [[1, 7], [3, 5], [4, 11], [5, 19]] as const) {
      const lockedGameweekIds = Array.from({ length: lockedCount }, (_, i) => i + 1);
      const breakdown = computePrizeBreakdown(entrants, lockedGameweekIds, []);

      expect(breakdown.winnerShare + breakdown.runnerUpShare + breakdown.sharedPotShare).toBe(breakdown.pot);
    }
  });
});
