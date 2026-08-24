// The avatars bucket is public and keyed by entrant id, so the URL is
// always derivable — no column needed to track "has an avatar or not".
// Whether the object actually exists is a client-side concern (the <img>
// just falls back to a placeholder on error).
export function avatarUrl(entrantId: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${entrantId}`;
}
