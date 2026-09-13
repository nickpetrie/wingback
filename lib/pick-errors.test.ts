import { describe, expect, it } from "vitest";
import { describePickFailure } from "./pick-errors";
import { UNREACHABLE } from "./actions";

describe("describePickFailure", () => {
  it("always says the pick is not registered, whatever went wrong", () => {
    // The one thing every failure has to communicate, in the same words, so
    // it reads the same however it is skimmed.
    const causes = [
      UNREACHABLE,
      "gameweek 4 is locked",
      "player 223094 is not available for this entrant this season",
      "free substitution limit (2 per season) already used",
      "not signed in",
      "something nobody has seen before",
      undefined,
    ];
    for (const cause of causes) {
      expect(describePickFailure(cause, 4).message).toContain("NOT registered");
    }
  });

  it("treats a gateway or network failure as worth retrying", () => {
    // The Palmer case: a 502 between the phone and the server. Nothing was
    // written, and the next attempt usually works.
    expect(describePickFailure(UNREACHABLE, 4).transient).toBe(true);
    expect(describePickFailure("TypeError: fetch failed", 4).transient).toBe(true);
    expect(describePickFailure("504 Gateway Time-out", 4).transient).toBe(true);
  });

  it("does not offer a retry for a rule the database will refuse again", () => {
    expect(describePickFailure("gameweek 4 is locked", 4).transient).toBe(false);
    expect(
      describePickFailure("player 223094 is not available for this entrant this season", 4).transient,
    ).toBe(false);
  });

  it("names the gameweek that locked, since that is the one that was lost", () => {
    expect(describePickFailure("gameweek 4 is locked", 4).message).toContain("Gameweek 4");
  });

  it("tells a signed-out entrant what to do rather than to retry", () => {
    const failure = describePickFailure("not signed in", 5);
    expect(failure.transient).toBe(false);
    expect(failure.message).toContain("Sign in");
  });

  it("retries an unrecognised failure rather than declaring it fatal", () => {
    // Unknown means unknown. Offering the attempt costs one tap; refusing it
    // on a guess costs a gameweek.
    expect(describePickFailure("kaboom", 4).transient).toBe(true);
  });
});
