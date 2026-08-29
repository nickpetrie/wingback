import { describe, expect, it } from "vitest";
import { isFixtureLive, liveState, nextLiveChangeAt, LIVE_RECHECK_MS, MAX_MATCH_MS } from "./live";

const KICKOFF = Date.parse("2026-08-29T14:00:00Z");

function fixture(over: Partial<Parameters<typeof isFixtureLive>[0]> = {}) {
  return {
    kickoff_time: "2026-08-29T14:00:00Z",
    started: false,
    played: false,
    ...over,
  };
}

describe("isFixtureLive", () => {
  it("is not live before kickoff", () => {
    expect(isFixtureLive(fixture(), KICKOFF - 60_000)).toBe(false);
  });

  it("goes live on the clock, without waiting for the sync to say started", () => {
    // The whole point: `score` runs every ten minutes, so `started` lags a
    // real kickoff. The badge should not lag with it.
    expect(isFixtureLive(fixture(), KICKOFF + 1000)).toBe(true);
  });

  it("goes live early when FPL says it started early", () => {
    expect(isFixtureLive(fixture({ started: true }), KICKOFF - 60_000)).toBe(true);
  });

  it("stops the moment the fixture is played", () => {
    // `played` is the only end signal trusted here — `finished` alone stays
    // false for days after full time.
    expect(isFixtureLive(fixture({ started: true, played: true }), KICKOFF + 60_000)).toBe(false);
  });

  it("gives up after the cap rather than claiming LIVE all week", () => {
    expect(isFixtureLive(fixture({ started: true }), KICKOFF + MAX_MATCH_MS - 1000)).toBe(true);
    expect(isFixtureLive(fixture({ started: true }), KICKOFF + MAX_MATCH_MS + 1000)).toBe(false);
  });

  it("treats a fixture with no kickoff time as not live", () => {
    expect(isFixtureLive(fixture({ kickoff_time: null, started: true }), KICKOFF)).toBe(false);
  });
});

describe("nextLiveChangeAt", () => {
  it("asks to be woken a minute later while something is live", () => {
    const now = KICKOFF + 60_000;
    expect(nextLiveChangeAt([fixture()], now)).toBe(now + LIVE_RECHECK_MS);
  });

  it("sleeps until the next kickoff when nothing is on", () => {
    const now = KICKOFF - 3 * 60 * 60 * 1000;
    expect(nextLiveChangeAt([fixture()], now)).toBe(KICKOFF);
  });

  it("picks the earliest of several upcoming kickoffs", () => {
    const later = { ...fixture(), kickoff_time: "2026-08-29T16:30:00Z" };
    const now = KICKOFF - 60 * 60 * 1000;
    expect(nextLiveChangeAt([later, fixture()], now)).toBe(KICKOFF);
  });

  it("has nothing to wait for once every fixture is played", () => {
    expect(nextLiveChangeAt([fixture({ played: true })], KICKOFF + 60_000)).toBeNull();
  });

  it("does not wake for a kickoff that has already been and gone", () => {
    // Past the cap and never marked played — a postponement, or a sync that
    // stopped. There is nothing here for a timer to wait on.
    expect(nextLiveChangeAt([fixture()], KICKOFF + MAX_MATCH_MS + 1000)).toBeNull();
  });
});

describe("liveState", () => {
  const home = { ...fixture(), team_h: 1, team_a: 2 };
  const away = { ...fixture(), kickoff_time: "2026-08-29T16:30:00Z", team_h: 3, team_a: 4 };

  it("badges both clubs in a match that is on, and neither in one that isn't", () => {
    const { liveTeamIds } = liveState([home, away], KICKOFF + 60_000);
    expect([...liveTeamIds].sort()).toEqual([1, 2]);
  });

  it("reports when to look again alongside the clubs", () => {
    const now = KICKOFF + 60_000;
    expect(liveState([home, away], now).nextChangeAt).toBe(now + LIVE_RECHECK_MS);
  });

  it("badges nobody before any kickoff, and waits for the first", () => {
    const now = KICKOFF - 60 * 60 * 1000;
    const state = liveState([home, away], now);
    expect(state.liveTeamIds.size).toBe(0);
    expect(state.nextChangeAt).toBe(KICKOFF);
  });
});
