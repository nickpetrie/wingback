import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE_OPTIONS } from "./cookies";
import type { Database } from "./types";

// Refreshes the auth session on every request. Server Components can't set
// cookies, so this is the only place a refreshed token actually gets
// written back to the browser.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: AUTH_COOKIE_OPTIONS,
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Redirecting means building a *different* response, and the refreshed
  // session cookies live on the one built above. Losing them is not a
  // cosmetic bug: Supabase rotates the refresh token on every use and treats
  // a retired one coming back as theft, so a single dropped Set-Cookie ends
  // with the whole session revoked and the entrant staring at a login form
  // they filled in last week. Every redirect out of here goes through this.
  const redirectTo = (pathname: string) => {
    const url = request.nextUrl.clone();
    url.pathname = pathname;
    const redirect = NextResponse.redirect(url);
    for (const cookie of response.cookies.getAll()) {
      redirect.cookies.set(cookie);
    }
    return redirect;
  };

  const { data, error } = await supabase.auth.getUser();
  const user = data.user;

  const isAuthRoute = request.nextUrl.pathname.startsWith("/login") ||
    request.nextUrl.pathname.startsWith("/auth");

  if (!user && !isAuthRoute) {
    // A network blip or a 5xx from the auth server is not the same thing as
    // "you are signed out", and treating it as such is how a phone on a bad
    // train connection ends up back at the sign-in form with a session that
    // was fine all along. Only a definite answer — no session, or a refresh
    // token the server has actually rejected — sends anyone to /login.
    if (error && !isAuthFailure(error)) return response;
    return redirectTo("/login");
  }

  // Someone already signed in has no business on the sign-in form, and the
  // decision has to be made *here* rather than in the page.
  //
  // /login has a loading.tsx that streams its green hero the instant the
  // route is entered, before the page component has finished asking the auth
  // server who you are. So a signed-in entrant opening the PWA got the login
  // header painted at them, then a blank while the page's own redirect
  // resolved, then home — which reads as the app failing to remember them.
  // Redirecting before any HTML is produced means the hero is never sent.
  //
  // /login only, not every auth route: /auth/confirm is the magic-link
  // callback, and it has to run *with* a session to exchange the code and
  // forward to `next`. Bouncing it would break the one flow it exists for.
  if (user && request.nextUrl.pathname.startsWith("/login")) {
    return redirectTo("/");
  }

  // First login: nobody has an account yet, they have a profile to claim.
  // /onboarding is exempt too — it's the very next (optional) step right
  // after claiming, not something to bounce back out of.
  const isClaimRoute = request.nextUrl.pathname.startsWith("/claim");
  const isOnboardingRoute = request.nextUrl.pathname.startsWith("/onboarding");
  if (user && !isAuthRoute && !isClaimRoute && !isOnboardingRoute) {
    const { data: entrant } = await supabase
      .from("entrants")
      .select("id")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (!entrant) return redirectTo("/claim");
  }

  return response;
}

/** True when the auth server gave a real verdict (no session, bad or expired
 * refresh token) rather than failing to answer. */
function isAuthFailure(error: { status?: number; name?: string }): boolean {
  if (error.name === "AuthSessionMissingError") return true;
  return typeof error.status === "number" && error.status >= 400 && error.status < 500;
}
