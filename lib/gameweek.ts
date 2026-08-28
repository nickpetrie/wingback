import type { createClient } from "@/lib/supabase/server";

export type GameweekState = "open" | "locked" | "unscheduled";

export interface CurrentGameweek {
  id: number;
  lock_at: string | null;
  state: GameweekState;
}

/**
 * The gameweek the app should be showing right now, and which of three
 * states it's in:
 *   - "open": still pickable, has a known lock_at in the future.
 *   - "locked": lock_at has passed — the matches are the story now, and no
 *     new pick can be made.
 *   - "unscheduled": it exists but FPL hasn't confirmed its fixture times
 *     yet (international breaks, early-season gaps) — lock_at is null, so
 *     it isn't really "locked", just not open either.
 * Returns null only when there's no gameweek data at all yet.
 *
 * The current gameweek is simply the earliest one that isn't finished, and
 * the state follows from its lock. It is deliberately *not* "the earliest
 * one still open for picks": that version skipped a gameweek the moment it
 * locked, so at one minute past the deadline the whole app jumped forward to
 * next week — the countdown, everyone's picks, the fixture list — while the
 * matches you had just picked for hadn't kicked off yet. A gameweek stops
 * being current when it is over, not when it closes.
 */
export async function getCurrentGameweek(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<CurrentGameweek | null> {
  const { data: gameweek } = await supabase
    .from("gameweeks")
    .select("id, lock_at")
    .eq("finished", false)
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!gameweek) return null;

  if (!gameweek.lock_at) {
    return { id: gameweek.id, lock_at: null, state: "unscheduled" };
  }

  const locked = new Date(gameweek.lock_at) <= new Date();
  return { id: gameweek.id, lock_at: gameweek.lock_at, state: locked ? "locked" : "open" };
}
