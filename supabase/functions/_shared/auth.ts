// Who may invoke a cron-driven function.
//
// The gateway's verify_jwt only checks that the bearer token is *a* valid
// JWT for this project — and the anon key is one. It ships in every page of
// the app, so anyone who has opened Wingback could invoke `score` or `remind`
// at will. None of these functions reads the caller's identity for anything
// else, so the check is simply: is this pg_cron? `call_edge_function()` in
// 20260101000004_cron.sql sends `Authorization: Bearer <service_role_key>`
// from Vault, and the platform injects that same key into the function as
// SUPABASE_SERVICE_ROLE_KEY. If the two differ, nothing scheduled runs — so
// DEPLOY.md §2 says to put the same key in both places.
//
// push-test is deliberately not behind this: the browser calls it with the
// entrant's own token, and it resolves that to an entrant itself.

/** A 401 when the caller is not holding the service-role key; null when it is. */
export async function assertServiceCaller(req: Request): Promise<Response | null> {
  const expected = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const header = req.headers.get("Authorization") ?? "";
  const given = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
  if (!expected || !given || !(await sameSecret(given, expected))) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  return null;
}

// Hashed first so the compared buffers are always the same length, then
// compared without an early exit — a plain `===` on the strings returns the
// moment it finds a differing character, and that is measurable.
async function sameSecret(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(a)),
    crypto.subtle.digest("SHA-256", enc.encode(b)),
  ]);
  const ua = new Uint8Array(ha);
  const ub = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < ua.length; i++) diff |= ua[i] ^ ub[i];
  return diff === 0;
}
