import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";
import { AUTH_COOKIE_OPTIONS } from "./cookies";
import type { Database } from "./types";

// Anon key + the viewer's own session, always. Every query this client
// makes runs under RLS — that's what makes the write-side rules hold no
// matter what a server component forgets to check. The service role key
// never appears here; it belongs only in edge function secrets.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: AUTH_COOKIE_OPTIONS,
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component that can't set cookies; the
            // middleware refreshes the session on every request instead.
          }
        },
      },
    },
  );
}

// getUser() is a network round trip to Supabase's auth server every single
// time — supabase-js deliberately does not trust a cached copy. Rendering
// /login made three of them (the middleware, Nav, and the page itself) to
// decide whether to show one email field, and every other route pays at least
// two. cache() is per-request, so this collapses them to one without ever
// carrying an identity across requests.
//
// Read path only. A server action that signs someone in or out must call
// supabase.auth.getUser() itself: there the whole point is to see the change
// the request just made.
export const getSessionUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});
