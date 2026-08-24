"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface ClaimResult {
  ok: boolean;
  error?: string;
}

export async function claimProfile(entrantId: string): Promise<ClaimResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not signed in" };

  // The WHERE clause (mirrored in the "entrants claim" RLS policy) is the
  // race-safety mechanism: if two people click the same name at once, only
  // the first UPDATE actually matches a row.
  const { data, error } = await supabase
    .from("entrants")
    .update({ auth_user_id: user.id, email: user.email })
    .eq("id", entrantId)
    .is("auth_user_id", null)
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Someone else just claimed that one — pick another." };

  redirect("/onboarding");
}
