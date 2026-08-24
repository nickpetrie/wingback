import { teamBadgeUrl } from "@/lib/team-badge";

/** Renders nothing when the team's crest code hasn't synced yet, rather than
 * a broken image — teams.code only backfills on the next sync-fpl run. */
export function TeamBadge({ code, size = 16 }: { code: number | null; size?: number }) {
  if (!code) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- external crest CDN, not eligible for next/image
    <img
      src={teamBadgeUrl(code)}
      alt=""
      width={size}
      height={size}
      style={{ display: "inline-block", verticalAlign: "middle", flex: "none" }}
    />
  );
}
