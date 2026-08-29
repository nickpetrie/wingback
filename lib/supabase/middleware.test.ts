import { NextResponse } from "next/server";
import { describe, expect, it } from "vitest";

// Supabase rotates the refresh token on every use and treats a retired one
// coming back as theft, revoking the whole session. So a response that carries
// a refreshed cookie is not an optimisation — dropping it signs the entrant
// out permanently, and that is precisely what updateSession's redirects used
// to do by building a fresh NextResponse and returning it.
//
// The real function needs a live auth server, so what's pinned here is the
// mechanic underneath it: cookies set on one response do not travel to
// another unless they are copied, and the copy works.
describe("carrying cookies onto a redirect", () => {
  it("loses them when a redirect is built from scratch", () => {
    const refreshed = NextResponse.next();
    refreshed.cookies.set("sb-auth-token", "rotated-value");

    const redirect = NextResponse.redirect(new URL("https://wingback.test/login"));

    // The bug, stated as a test: nothing carries over on its own.
    expect(redirect.cookies.get("sb-auth-token")).toBeUndefined();
  });

  it("keeps them when each cookie is copied across", () => {
    const refreshed = NextResponse.next();
    refreshed.cookies.set("sb-auth-token", "rotated-value");
    refreshed.cookies.set("sb-refresh-token", "rotated-refresh");

    const redirect = NextResponse.redirect(new URL("https://wingback.test/login"));
    for (const cookie of refreshed.cookies.getAll()) {
      redirect.cookies.set(cookie);
    }

    expect(redirect.cookies.get("sb-auth-token")?.value).toBe("rotated-value");
    expect(redirect.cookies.get("sb-refresh-token")?.value).toBe("rotated-refresh");
  });
});

describe("auth cookie options", () => {
  it("asks for a session that outlives a season, not a browser tab", async () => {
    const { AUTH_COOKIE_OPTIONS } = await import("./cookies");
    // A session cookie (no maxAge) is gone when the browser decides it is,
    // which on an installed PWA is far sooner than a 38-gameweek season.
    expect(AUTH_COOKIE_OPTIONS.maxAge).toBeGreaterThan(300 * 24 * 60 * 60);
    expect(AUTH_COOKIE_OPTIONS.sameSite).toBe("lax");
    expect(AUTH_COOKIE_OPTIONS.path).toBe("/");
  });
});
