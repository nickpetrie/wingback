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
 *   - "locked": lock_at has passed (or the gameweek is otherwise live) —
 *     picks are visible, but no new pick can be made.
 *   - "unscheduled": the next not-yet-finished gameweek exists but FPL
 *     hasn't confirmed its fixture times yet (international breaks,
 *     early-season gaps) — lock_at is null, so it isn't really "locked",
 *     just not open either.
 * Returns null only when there's no gameweek data at all yet.
 */
export async function getCurrentGameweek(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<CurrentGameweek | null> {
  const { data: openGameweek } = await supabase
    .from("gameweeks")
    .select("id, lock_at")
    .eq("finished", false)
    .not("lock_at", "is", null)
    .gt("lock_at", new Date().toISOString())
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (openGameweek) {
    return { id: openGameweek.id, lock_at: openGameweek.lock_at, state: "open" };
  }

  const { data: fallbackGameweek } = await supabase
    .from("gameweeks")
    .select("id, lock_at")
    .eq("finished", false)
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!fallbackGameweek) return null;

  const isLocked = !!fallbackGameweek.lock_at && new Date(fallbackGameweek.lock_at) <= new Date();
  return {
    id: fallbackGameweek.id,
    lock_at: fallbackGameweek.lock_at,
    state: isLocked ? "locked" : "unscheduled",
  };
}
