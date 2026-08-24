import type { createClient } from "@/lib/supabase/server";

/** The entrant row id for whoever is signed in, or null if they haven't
 * claimed a profile yet (shouldn't normally happen — middleware sends
 * unclaimed users to /claim before they reach anywhere that calls this). */
export async function getCurrentEntrantId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  authUserId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("entrants")
    .select("id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  return data?.id ?? null;
}
