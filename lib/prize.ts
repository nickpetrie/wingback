// The pot is derived, never stored — same rule and the same reason as
// pick_points() in the database (see CLAUDE.md): a stored total can drift
// from the picks that produced it, and nothing would ever notice.

/** The three-way split, as percentages of the pot. The owner wants to be
 * able to eyeball and change these, so they're the one thing at the top of
 * the file — and they MUST sum to 100, checked below at import time so a
 * typo here fails loudly instead of quietly shorting someone's share. */
export const WINNER_SHARE_PCT = 60;
export const RUNNER_UP_SHARE_PCT = 25;
export const SHARED_POT_SHARE_PCT = 15;

if (WINNER_SHARE_PCT + RUNNER_UP_SHARE_PCT + SHARED_POT_SHARE_PCT !== 100) {
  throw new Error("prize shares must sum to 100");
}

export interface PrizePick {
  gameweek: number;
  stake: 3 | 6;
}

export interface PrizeBreakdown {
  pot: number;
  lockedGameweeks: number;
  winnerShare: number;
  runnerUpShare: number;
  sharedPotShare: number;
  sharedPotPerEntrant: number;
}

/**
 * £3 per entrant per locked gameweek, £6 for a gameweek they staked £6 —
 * owed whether or not they actually picked (gameweek 1: two of five picked,
 * all five paid). So the base amount comes from the entrant count and the
 * locked gameweek count alone; a picks row only ever adds the extra £3 for
 * a doubled stake, and only if its gameweek has locked.
 */
export function computePrizeBreakdown(
  entrantCount: number,
  lockedGameweekIds: number[],
  picks: PrizePick[],
): PrizeBreakdown {
  const locked = new Set(lockedGameweekIds);

  const basePence = locked.size * entrantCount * 300;
  const doubledExtraPence = picks.filter((p) => locked.has(p.gameweek) && p.stake === 6).length * 300;
  const potPence = basePence + doubledExtraPence;

  // Round the two named shares to the nearest penny and let the shared pot
  // take whatever's left, rather than rounding all three independently —
  // that's what guarantees the three numbers always add back up to the pot,
  // instead of drifting a penny short (or over) under naive rounding.
  const winnerPence = Math.round((potPence * WINNER_SHARE_PCT) / 100);
  const runnerUpPence = Math.round((potPence * RUNNER_UP_SHARE_PCT) / 100);
  const sharedPotPence = potPence - winnerPence - runnerUpPence;

  return {
    pot: potPence / 100,
    lockedGameweeks: locked.size,
    winnerShare: winnerPence / 100,
    runnerUpShare: runnerUpPence / 100,
    sharedPotShare: sharedPotPence / 100,
    sharedPotPerEntrant: entrantCount > 0 ? sharedPotPence / entrantCount / 100 : 0,
  };
}
