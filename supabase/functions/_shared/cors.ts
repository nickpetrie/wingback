// CORS for the one function a browser calls directly.
//
// A cross-origin POST carrying an Authorization header is not a "simple"
// request, so the browser sends an OPTIONS preflight first. A preflight
// deliberately carries no credentials — which means a function deployed with
// verify_jwt on has its preflight rejected by Supabase's gateway with a 401
// before the function is ever reached. The browser then refuses to send the
// real request, and supabase-js reports the unhelpful "Failed to send a
// request to the Edge Function", which reads like the function is broken when
// nothing has run at all.
//
// So any browser-invoked function must be deployed with verify_jwt off and
// check the caller itself. That is not a weakening: push-test already reads
// the caller's own token, resolves it to an entrant, and only ever pushes to
// that entrant's own subscriptions.
//
// The origin is `*` because CORS is not the security boundary here — the
// bearer token is. A hostile page cannot read a Wingback token out of another
// origin's storage, so allowing it to *make* a request buys it nothing.
export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

/** The preflight response, or null when this isn't a preflight. */
export function preflight(req: Request): Response | null {
  return req.method === "OPTIONS" ? new Response(null, { status: 204, headers: CORS_HEADERS }) : null;
}

/** Response.json, with the CORS headers attached — because a reply the
 * browser refuses to read is the same as no reply. */
export function corsJson(body: unknown, init?: ResponseInit): Response {
  return Response.json(body, {
    ...init,
    headers: { ...CORS_HEADERS, ...(init?.headers ?? {}) },
  });
}
