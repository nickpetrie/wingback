// Client-side mirror of the reuse/double rules, for warnings only. The
// database trigger (picks_guard, see supabase/migrations) is the actual
// enforcement — this just lets the pick screen warn before a submit fails.

export interface PickHistoryEntry {
  gameweek: number;
  player_code: number;
  goals: number;
  stake: 3 | 6;
}

/** player_code -> current use-count since its last hat-trick reset. */
export function computeUsedCounts(history: PickHistoryEntry[]): Map<number, number> {
  const counts = new Map<number, number>();
  const sorted = [...history].sort((a, b) => a.gameweek - b.gameweek);
  for (const h of sorted) {
    const next = (counts.get(h.player_code) ?? 0) + 1;
    counts.set(h.player_code, h.goals >= 3 ? 0 : next);
  }
  return counts;
}

export function isPlayerAvailable(
  code: number,
  counts: Map<number, number>,
  nominationCode: number | null,
): boolean {
  const limit = code === nominationCode ? 2 : 1;
  return (counts.get(code) ?? 0) < limit;
}

export function doublesUsed(history: PickHistoryEntry[]): number {
  return history.filter((h) => h.stake === 6).length;
}

/** Diacritic-insensitive substring match: "gyokeres" finds "Gyökeres". */
const COMBINING_MARKS = new RegExp("[\\u0300-\\u036f]", "g");

export function foldDiacritics(value: string): string {
  return value.normalize("NFD").replace(COMBINING_MARKS, "").toLowerCase();
}
