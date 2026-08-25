// The avatars bucket is public and keyed by entrant id, so the URL is
// always derivable — no column needed to track "has an avatar or not".
// Whether the object actually exists is a client-side concern (the <img>
// just falls back to a placeholder on error).
export function avatarUrl(entrantId: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${entrantId}`;
}

/** "Nick Petrie" → "NP". Falls back to a single letter for one-word names. */
export function initialsFor(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
