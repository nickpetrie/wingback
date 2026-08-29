import { describe, expect, it } from "vitest";
import {
  computeUsedCounts,
  doublesUsed,
  foldDiacritics,
  isPlayerAvailable,
  type PickHistoryEntry,
} from "./rules";

// These mirror picks_guard, which is the real enforcement — so what's being
// checked here is that the *warning* the pick screen shows agrees with the
// refusal the database would issue. The two disagreeing is worse than either
// being wrong alone: it either blocks a pick the database would accept, or
// promises one it won't.

const pick = (gameweek: number, player_code: number, goals = 0, stake: 3 | 6 = 3): PickHistoryEntry =>
  ({ gameweek, player_code, goals, stake });

describe("computeUsedCounts", () => {
  it("counts each use of a player", () => {
    const counts = computeUsedCounts([pick(1, 100), pick(2, 100), pick(3, 200)]);
    expect(counts.get(100)).toBe(2);
    expect(counts.get(200)).toBe(1);
  });

  it("resets a player's count to zero on a hat-trick", () => {
    // Three goals puts the player back on the board, which is the one way a
    // used player becomes pickable again.
    const counts = computeUsedCounts([pick(1, 100, 3)]);
    expect(counts.get(100)).toBe(0);
  });

  it("counts uses after a hat-trick from zero again", () => {
    const counts = computeUsedCounts([pick(1, 100, 3), pick(5, 100, 0)]);
    expect(counts.get(100)).toBe(1);
  });

  it("reads history in gameweek order, not array order", () => {
    // The rows come back from Postgres unordered; a hat-trick in gameweek 1
    // must still reset before the gameweek 5 use is counted.
    const counts = computeUsedCounts([pick(5, 100, 0), pick(1, 100, 3)]);
    expect(counts.get(100)).toBe(1);
  });
});

describe("isPlayerAvailable", () => {
  const nomination = 999;

  it("allows a player nobody has used", () => {
    expect(isPlayerAvailable(100, new Map(), nomination)).toBe(true);
  });

  it("refuses an ordinary player after one use", () => {
    expect(isPlayerAvailable(100, new Map([[100, 1]]), nomination)).toBe(false);
  });

  it("allows the nomination a second use", () => {
    expect(isPlayerAvailable(nomination, new Map([[nomination, 1]]), nomination)).toBe(true);
  });

  it("refuses the nomination a third use", () => {
    expect(isPlayerAvailable(nomination, new Map([[nomination, 2]]), nomination)).toBe(false);
  });

  it("gives nobody a second use when no nomination is set", () => {
    expect(isPlayerAvailable(100, new Map([[100, 1]]), null)).toBe(false);
  });
});

describe("doublesUsed", () => {
  it("counts only the £6 stakes", () => {
    expect(doublesUsed([pick(1, 100, 0, 6), pick(2, 200, 0, 3), pick(3, 300, 0, 6)])).toBe(2);
  });
});

describe("foldDiacritics", () => {
  it("matches an accented name typed without accents", () => {
    expect(foldDiacritics("Gyökeres")).toContain("gyokeres");
  });

  it("lowercases, so search is case-insensitive", () => {
    expect(foldDiacritics("HAALAND")).toBe("haaland");
  });
});
