// Crests are keyed by the team's stable `code` (not its per-season `id`),
// same CDN the FPL site itself uses.
export function teamBadgeUrl(teamCode: number): string {
  return `https://resources.premierleague.com/premierleague/badges/70/t${teamCode}.png`;
}
