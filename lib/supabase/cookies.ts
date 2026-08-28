// One place that decides how the auth cookies are written, shared by the
// browser, server and middleware clients.
//
// @supabase/ssr already defaults to a 400-day maxAge, but "already defaults
// to" is exactly the kind of thing that changes under you in a minor
// release, and the whole point of this file is that a signed-in phone stays
// signed in for a season. Stating it here also documents the intent.
const ONE_YEAR_AND_A_BIT = 400 * 24 * 60 * 60;

export const AUTH_COOKIE_OPTIONS = {
  path: "/",
  sameSite: "lax" as const,
  // Safari refuses `Secure` cookies over plain http, which would break
  // `next dev` on localhost entirely.
  secure: process.env.NODE_ENV === "production",
  maxAge: ONE_YEAR_AND_A_BIT,
};
