import { describe, expect, it } from "vitest";
import { buildState, usedCounts } from "./state.mjs";
import { computeUsedCounts } from "../lib/rules";

const NOW = Date.parse("2026-09-07T04:10:00Z");

const entrants = [
  { id: "e1", display_name: "Nick", nomination_player_code: 100 },
  { id: "e2", display_name: "Tom", nomination_player_code: null },
];
const players = [
  { code: 100, web_name: "Isak", element_type: 4, team_id: 1 },
  { code: 200, web_name: "Gabriel", element_type: 2, team_id: 2 },
];
const teams = [
  { id: 1, short_name: "NEW" },
  { id: 2, short_name: "ARS" },
];
const gameweeks = [
  { id: 1, deadline_time: "2026-08-21T17:30:00Z", lock_at: "2026-08-21T18:00:00Z", finished: true },
  { id: 2, deadline_time: "2026-09-12T12:30:00Z", lock_at: "2026-09-12T13:00:00Z", finished: false },
];
const picks = [
  { entrant_id: "e1", gameweek: 1, player_code: 100, stake: 3, goals: 1 },
  { entrant_id: "e2", gameweek: 1, player_code: 200, stake: 6, goals: 1 },
];
const leaderboard = [
  { display_name: "Tom", total_points: 4, scoring_gameweeks: 1 },
  { display_name: "Nick", total_points: 1, scoring_gameweeks: 1 },
];

const base = { now: NOW, entrants, players, teams, gameweeks, picks, leaderboard };

describe("buildState", () => {
  it("names the earliest unfinished gameweek as the one in play", () => {
    // The same rule `remind` uses. If these two ever disagree the digest is
    // lying about the thing it exists to answer.
    const md = buildState(base);
    expect(md).toContain("**Gameweek 2** is the one in play — open for picks");
  });

  it("says who has not picked, by name", () => {
    expect(buildState(base)).toContain("Still to pick: Nick, Tom");
  });

  it("counts a locked gameweek's absentees as having missed it, not as pending", () => {
    const md = buildState({
      ...base,
      now: Date.parse("2026-09-12T14:00:00Z"),
    });
    expect(md).toContain("Missed the deadline: Nick, Tom");
    expect(md).not.toContain("Still to pick");
  });

  it("re-derives points rather than reading a stored column", () => {
    // Gabriel is a defender at a £6 stake: 1 goal × 2 × 2.
    expect(buildState(base)).toMatch(/Gabriel ×2 — 4pt/);
  });

  it("shows a nomination's allowance as used out of two, with the gameweeks", () => {
    expect(buildState(base)).toContain("1/2 (GW 1)");
  });

  it("names the players an entrant can no longer pick, not just the nomination", () => {
    // The nomination column alone reads as if Tom were unconstrained, when the
    // player he actually burned is the thing that limits him. Reading one
    // without the other is how a nomination gets mistaken for a pick.
    const md = buildState(base);
    expect(md).toContain("| Tom | _none set_ |  | — | Gabriel |");
  });

  it("flags an entrant who wants push but has registered no device", () => {
    const md = buildState({
      ...base,
      alertPrefs: [
        { entrant_id: "e1", push: true, email: true, sms: false },
        { entrant_id: "e2", push: true, email: true, sms: false },
      ],
      pushSubscriptions: [{ entrant_id: "e1" }],
    });
    expect(md).toContain("**0 — gets no push**");
    expect(md.match(/\*\*0 — gets no push\*\*/g)).toHaveLength(1);
  });

  it("formats times in UTC so the daily diff does not depend on the runner", () => {
    expect(buildState(base)).toContain("Sat 12 Sep 2026, 12:30 UTC");
  });

  it("agrees with the picker about who is spent, hat-tricks included", () => {
    // Two implementations of one rule: this one under plain node on a GitHub
    // runner, computeUsedCounts in the app's TypeScript. A digest that
    // disagreed with the picker about who is still available would be worse
    // than no digest, so they are run over the same histories here.
    const histories = [
      [],
      [{ gameweek: 1, player_code: 100, goals: 1, stake: 3 }],
      [
        { gameweek: 1, player_code: 100, goals: 0, stake: 3 },
        { gameweek: 2, player_code: 100, goals: 1, stake: 6 },
      ],
      // The reset, and a use after it.
      [
        { gameweek: 1, player_code: 100, goals: 3, stake: 3 },
        { gameweek: 2, player_code: 100, goals: 0, stake: 3 },
      ],
      // Out of order on the way in, which is the case that made sorting matter.
      [
        { gameweek: 3, player_code: 200, goals: 0, stake: 3 },
        { gameweek: 1, player_code: 200, goals: 4, stake: 6 },
      ],
    ];

    for (const history of histories) {
      expect([...usedCounts(history).entries()].sort()).toEqual(
        [...computeUsedCounts(history).entries()].sort(),
      );
    }
  });

  it("survives an empty database rather than throwing", () => {
    expect(() => buildState({ now: NOW })).not.toThrow();
    expect(buildState({ now: NOW })).toContain("Nobody has picked yet.");
  });
});
