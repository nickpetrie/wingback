import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // api/fpl is exempt: it carries its own shared-secret auth and is called by
  // the Supabase edge functions, which have no browser session. Without the
  // exemption updateSession redirects them to /login, fetch follows the
  // redirect, and the caller gets 200 + the login page's HTML instead of FPL
  // JSON — which surfaces as "Unexpected token '<'", not as an auth error.
  matcher: [
    "/((?!api/fpl|_next/static|_next/image|favicon.ico|opengraph-image|twitter-image|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
