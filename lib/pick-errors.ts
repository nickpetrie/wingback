// Turning a save failure into something an entrant can act on.
//
// A pick is one row against a hard deadline, and the screen showing it was the
// only thing telling Casra whether it had landed. When the gateway 502'd on
// his Palmer pick the throw escaped the transition entirely — nothing caught
// it, nothing set an error, and the card went on showing Palmer exactly as it
// does for a pick that saved. He believed he had picked; nobody else saw it
// and no alert fired, because the row was never written.
//
// So two rules here. Every message ends by saying the pick is not registered,
// in those words — the failure has to be legible without reading the cause.
// And a failure we have reason to think is transient says so, because the
// honest advice differs: try again now, versus this will never work.

import { UNREACHABLE } from "./actions";

/** What a caller shows and does about a failure. */
export interface PickFailure {
  /** What went wrong, in a sentence an entrant can act on. */
  message: string;
  /** Worth another attempt — a blip rather than a rule. */
  transient: boolean;
}

export function describePickFailure(raw: string | undefined, gameweek: number): PickFailure {
  const error = (raw ?? "").toLowerCase();

  if (raw === UNREACHABLE || /fetch|network|timeout|gateway|502|503|504|unexpected response/.test(error)) {
    return {
      message: "Couldn't reach the server, so your pick is NOT registered. Try again.",
      transient: true,
    };
  }

  // picks_guard, the database's own last word. These are rules, not blips:
  // retrying changes nothing, so they never offer it.
  if (error.includes("is locked")) {
    return {
      message: `Gameweek ${gameweek} locked before this saved, so your pick is NOT registered.`,
      transient: false,
    };
  }
  if (error.includes("is not available for this entrant")) {
    return {
      message: "You've already used this player this season, so your pick is NOT registered.",
      transient: false,
    };
  }
  if (error.includes("free substitution")) {
    return {
      message: "That substitution isn't allowed, so your pick is NOT registered.",
      transient: false,
    };
  }

  if (error.includes("not signed in") || error.includes("jwt") || error.includes("no claimed profile")) {
    return {
      message: "You've been signed out, so your pick is NOT registered. Sign in and pick again.",
      transient: false,
    };
  }

  return {
    message: "Something went wrong saving this, so your pick is NOT registered. Try again.",
    transient: true,
  };
}
