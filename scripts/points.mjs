/** The scoring rule, mirroring pick_points() in
 * supabase/migrations/20260101000001_functions.sql:
 *
 *   goals × (defender ? 2 : 1) × (£6 stake ? 2 : 1)
 *
 * Points are never stored anywhere — not in the database, not in the backup —
 * so this is the only copy of the rule outside SQL, and the only reason it
 * exists at all is that the CSV in `backups/` has to be readable by a human
 * without a database to hand.
 *
 * Its own file so it can be tested. The first draft of the backup script
 * inlined an invented FPL-style per-position table (6 for a keeper, 5 for a
 * midfielder) which would have produced a backup that quietly disagreed with
 * the app about every scoreline — the exact failure this app exists to end.
 *
 * element_type: 1 GK, 2 DEF, 3 MID, 4 FWD.
 */
export function pointsFor(elementType, stake, goals) {
  return goals * (elementType === 2 ? 2 : 1) * (stake === 6 ? 2 : 1);
}
