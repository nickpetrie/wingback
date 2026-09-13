import { describe, expect, it } from "vitest";
import {
  computeSeasonAwards,
  isSeasonComplete,
  type AwardGameweek,
  type AwardPick,
} from "./awards";

describe("isSeasonComplete", () => {
  it("is false with fewer gameweeks than the season", () => {
    const gws: AwardGameweek[] = [{ id: 1, finished: true, lockAt: null }];
    expect(isSeasonComplete(gws, 3)).toBe(false);
  });

  it("is false when any gameweek hasn't finished", () => {
    const gws: AwardGameweek[] = [
      { id: 1, finished: true, lockAt: null },
      { id: 2, finished: false, lockAt: null },
      { id: 3, finished: true, lockAt: null },
    ];
    expect(isSeasonComplete(gws, 3)).toBe(false);
  });

  it("is true once every gameweek has finished", () => {
    const gws: AwardGameweek[] = [
      { id: 1, finished: true, lockAt: null },
      { id: 2, finished: true, lockAt: null },
      { id: 3, finished: true, lockAt: null },
    ];
    expect(isSeasonComplete(gws, 3)).toBe(true);
  });
});

describe("computeSeasonAwards", () => {
  it("returns null for an unfinished season — nothing is handed out early", () => {
    const gws: AwardGameweek[] = [
      { id: 1, finished: true, lockAt: "2024-01-01T12:00:00Z" },
      { id: 2, finished: false, lockAt: "2024-01-08T12:00:00Z" },
    ];
    const picks: AwardPick[] = [
      { entrantId: "a", gameweek: 1, playerCode: 1, stake: 3, goals: 2, points: 2, createdAt: "2024-01-01T11:00:00Z" },
    ];
    expect(computeSeasonAwards(picks, gws, 2)).toBeNull();
  });

  // A four-gameweek, three-entrant season, worked out by hand below each
  // pick. Deliberately dense enough to exercise every award at once —
  // including two genuine ties — rather than one contrived case apiece.
  const gws: AwardGameweek[] = [
    { id: 1, finished: true, lockAt: "2024-01-01T12:00:00Z" },
    { id: 2, finished: true, lockAt: "2024-01-08T12:00:00Z" },
    { id: 3, finished: true, lockAt: "2024-01-15T12:00:00Z" },
    { id: 4, finished: true, lockAt: "2024-01-22T12:00:00Z" },
  ];

  const picks: AwardPick[] = [
    // GW1 — A and B each exclusive on their own player; C has no pick.
    // A scores (2 pts) with a submit 30 min before lock —
    // inside the last hour, so it counts for Deadline Dan.
    { entrantId: "a", gameweek: 1, playerCode: 101, stake: 3, goals: 2, points: 2, createdAt: "2024-01-01T11:30:00Z" },
    // B blanks (0 pts) — exclusive but worthless for the Vulture — and
    // submits hours early, so it doesn't count for Deadline Dan.
    { entrantId: "b", gameweek: 1, playerCode: 102, stake: 3, goals: 0, points: 0, createdAt: "2024-01-01T08:00:00Z" },

    // GW2 — A and B both pick player 201 (the Sheep gameweek for both).
    // B's submit lands 10 minutes before lock, inside the window.
    { entrantId: "a", gameweek: 2, playerCode: 201, stake: 3, goals: 1, points: 1, createdAt: "2024-01-08T08:00:00Z" },
    { entrantId: "b", gameweek: 2, playerCode: 201, stake: 3, goals: 3, points: 3, createdAt: "2024-01-08T11:50:00Z" },
    // C is exclusive on player 202 but blanks — no Vulture points.
    { entrantId: "c", gameweek: 2, playerCode: 202, stake: 6, goals: 0, points: 0, createdAt: "2024-01-08T08:00:00Z" },

    // GW3 — A exclusive on a defender (double points): 2 × 2 = 4.
    // B has no pick here at all — this is what breaks B's Nostradamus run
    // between GW2 and GW4 even though both of those scored.
    { entrantId: "a", gameweek: 3, playerCode: 301, stake: 3, goals: 2, points: 4, createdAt: "2024-01-15T08:00:00Z" },
    { entrantId: "c", gameweek: 3, playerCode: 302, stake: 3, goals: 0, points: 0, createdAt: "2024-01-15T08:00:00Z" },

    // GW4 — A blanks (still holding a pick — this is what feeds Ice Cold
    // for A, though C's run below beats it). B exclusive and scores.
    { entrantId: "a", gameweek: 4, playerCode: 401, stake: 3, goals: 0, points: 0, createdAt: "2024-01-22T08:00:00Z" },
    { entrantId: "b", gameweek: 4, playerCode: 402, stake: 3, goals: 1, points: 1, createdAt: "2024-01-22T08:00:00Z" },
  ];

  const awards = computeSeasonAwards(picks, gws, 4);

  it("computes something once the season is complete", () => {
    expect(awards).not.toBeNull();
  });

  it("Vulture — A: 2 (GW1) + 4 (GW3, defender doubled) = 6, the only exclusive scoring picks", () => {
    expect(awards!.vulture).toEqual({ winners: ["a"], value: 6 });
  });

  it("Sheep — A and B both picked player 201 in GW2, tied on 1 gameweek each", () => {
    expect(awards!.sheep).toEqual({ winners: ["a", "b"], value: 1 });
  });

  it("Nostradamus — A scores GW1-GW3 running (B's GW2/GW4 are split by a missing GW3)", () => {
    expect(awards!.nostradamus).toEqual({ winners: ["a"], value: 3 });
  });

  it("Ice Cold — C blanks GW2 and GW3 back to back; no pick in GW1/GW4 bounds the run", () => {
    expect(awards!.iceCold).toEqual({ winners: ["c"], value: 2 });
  });

  it("The Cautious — every pick here is at stake 3, so it's just total points: A leads on 7", () => {
    expect(awards!.cautious).toEqual({ winners: ["a"], value: 7 });
  });

  it("Deadline Dan — A (GW1) and B (GW2) each have exactly one pick inside the last hour", () => {
    expect(awards!.deadlineDan).toEqual({ winners: ["a", "b"], value: 1 });
  });

  it("a gameweek nobody picked in doesn't extend anyone's streak", () => {
    // Isolated check of the same rule the worked example exercises on B:
    // a missing pick breaks a run rather than being skipped over.
    const soloGws: AwardGameweek[] = [
      { id: 1, finished: true, lockAt: null },
      { id: 2, finished: true, lockAt: null },
      { id: 3, finished: true, lockAt: null },
    ];
    const soloPicks: AwardPick[] = [
      { entrantId: "x", gameweek: 1, playerCode: 1, stake: 3, goals: 1, points: 1, createdAt: "2024-01-01T00:00:00Z" },
      // no pick in gameweek 2
      { entrantId: "x", gameweek: 3, playerCode: 1, stake: 3, goals: 1, points: 1, createdAt: "2024-01-15T00:00:00Z" },
    ];
    const result = computeSeasonAwards(soloPicks, soloGws, 3);
    expect(result!.nostradamus).toEqual({ winners: ["x"], value: 1 });
  });
});
