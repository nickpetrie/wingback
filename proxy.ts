import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // /api is exempt as a whole, for two reasons:
  //
  //  - api/fpl carries its own shared-secret auth and is called by the
  //    Supabase edge functions, which have no browser session. Without the
  //    exemption updateSession redirects them to /login, fetch follows the
  //    redirect, and the caller gets 200 + the login page's HTML instead of
  //    FPL JSON — which surfaces as "Unexpected token '<'", not as an auth
  //    error.
  //  - api/player-image is a subresource: one leaderboard fires ~38 of them
  //    in parallel, and running the session refresh on each meant ~38 extra
  //    round trips to the auth server per page view, all racing to rotate
  //    the same refresh token. Those routes read the session from the
  //    cookie directly; the document request that pulled them in has
  //    already been through here, so the token they read is fresh.
  matcher: [
    "/((?!api/|_next/static|_next/image|favicon.ico|opengraph-image|twitter-image|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
