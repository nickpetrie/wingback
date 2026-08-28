import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
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

