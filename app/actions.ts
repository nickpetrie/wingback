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

export interface PushSubscriptionInput {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** Store (or refresh) this browser's push subscription. Keyed on endpoint, so
 * re-subscribing the same browser updates one row rather than adding a second
 * that would deliver a duplicate of every notification. */
export async function savePushSubscription(
  sub: PushSubscriptionInput,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not signed in" };

  const { data: entrant } = await supabase
    .from("entrants")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!entrant) return { ok: false, error: "no claimed profile" };

  if (!sub.endpoint || !sub.p256dh || !sub.auth) {
    return { ok: false, error: "incomplete subscription" };
  }

  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(
      { endpoint: sub.endpoint, entrant_id: entrant.id, p256dh: sub.p256dh, auth: sub.auth },
      { onConflict: "endpoint" },
    );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function removePushSubscription(
  endpoint: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
