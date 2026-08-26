"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/** Record that the current entrant's photo changed. The bucket write happens
 * from the browser under RLS; this is the bit that makes it visible to
 * everyone else, and busts the cached copy of the old one. */
export async function markAvatarUploaded(): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not signed in" };

  const { error } = await supabase
    .from("entrants")
    .update({ avatar_updated_at: new Date().toISOString() })
    .eq("auth_user_id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}
