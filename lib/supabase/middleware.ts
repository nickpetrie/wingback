import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthRoute = request.nextUrl.pathname.startsWith("/login") ||
    request.nextUrl.pathname.startsWith("/auth");

  if (!user && !isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // First login: send them to settings to actually choose a display name,
  // rather than silently keeping the auto-generated email-prefix default.
  const isSettingsRoute = request.nextUrl.pathname.startsWith("/settings");
  if (user && !isAuthRoute && !isSettingsRoute) {
    const { data: entrant } = await supabase
      .from("entrants")
      .select("display_name_set")
      .eq("id", user.id)
      .maybeSingle();

    if (entrant && !entrant.display_name_set) {
      const url = request.nextUrl.clone();
      url.pathname = "/settings";
      url.searchParams.set("welcome", "1");
      return NextResponse.redirect(url);
    }
  }

  return response;
}
