import { createBrowserClient } from "@supabase/ssr";
import { AUTH_COOKIE_OPTIONS } from "./cookies";
import type { Database } from "./types";

// Anon key + the viewer's session, same as the server client. Never the
// service role key — that would hand every browser tab a way around RLS.
//
// The session lives in cookies (not localStorage) so the server rendering
// every page can see it; persistSession/autoRefreshToken are spelled out
// rather than left to defaults because this client is also what keeps a
// long-lived Realtime connection authenticated.
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: AUTH_COOKIE_OPTIONS,
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "pkce",
      },
    },
  );
}
