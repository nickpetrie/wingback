// Service-role client for edge functions only. This key must never reach
// the Next.js app tier — it belongs in Supabase function secrets alone.
import { createClient } from "npm:@supabase/supabase-js@2";

export function serviceClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set for this function",
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}
