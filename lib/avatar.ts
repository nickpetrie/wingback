// The avatars bucket is public and keyed by entrant id, so the path is always
// derivable. Whether an object actually exists is *not* derivable, though, and
// guessing at it client-side (render an <img>, fall back on error) was what
// left an uploaded photo showing as initials — see
// 20260101000017_avatar_updated_at.sql. `entrants.avatar_updated_at` is the
// answer to "is there a photo", and doubles as the cache-busting token.
function objectUrl(entrantId: string, version: number): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${entrantId}?v=${version}`;
}

export function avatarUrl(entrantId: string, updatedAt: string | null): string | null {
  if (!updatedAt) return null;
  const version = Date.parse(updatedAt);
  return objectUrl(entrantId, Number.isNaN(version) ? 0 : version);
}

/** The uploader's own preview, which has to show the new photo before the
 * server round-trip that records it — so it counts its own versions. */
export function avatarPreviewUrl(entrantId: string, version: number): string {
  return objectUrl(entrantId, version);
}

/** "Nick Petrie" → "NP". Falls back to a single letter for one-word names. */
export function initialsFor(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
