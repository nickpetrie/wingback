import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";

// Anon key + the viewer's session, same as the server client. Never the
// service role key — that would hand every browser tab a way around RLS.
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
