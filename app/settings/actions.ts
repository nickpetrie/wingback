"use server";

import { revalidatePath } from "next/cache";
import type { AlertPrefs } from "@/lib/alerts";
import { createClient } from "@/lib/supabase/server";

export interface SettingsResult {
  ok: boolean;
  error?: string;
}

/** The number only. Whether SMS is *on* is owned by alert_prefs.sms — two
 * switches for one decision is how a settings screen starts lying. */
export async function updatePhone(phone: string): Promise<SettingsResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not signed in" };

  const trimmed = phone.trim();
  const { error } = await supabase
    .from("entrants")
    .update({ phone: trimmed.length > 0 ? trimmed : null })
    .eq("auth_user_id", user.id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings");
  return { ok: true };
}

export async function updateNomination(playerCode: number): Promise<SettingsResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not signed in" };

  const { error } = await supabase
    .from("entrants")
    .update({ nomination_player_code: playerCode })
    .eq("auth_user_id", user.id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings");
  return { ok: true };
}

/** Save the whole alert preference set at once. It's eight booleans on one
 * row; sending the lot on every toggle costs nothing and means the row can
 * never end up describing a state the screen never showed. */
export async function updateAlertPrefs(prefs: AlertPrefs): Promise<SettingsResult> {
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

  // Upsert, not update: an entrant who predates the alert_prefs table has no
  // row yet, and an update that matches nothing reports success while saving
  // nothing at all.
  const { error } = await supabase
    .from("alert_prefs")
    .upsert(
      { entrant_id: entrant.id, ...prefs, updated_at: new Date().toISOString() },
      { onConflict: "entrant_id" },
    );

  if (error) return { ok: false, error: error.message };

  // entrants.sms_opt_in predates this table and the deployed reminder
  // function still reads it. Mirrored here rather than left to drift, so the
  // two can never disagree about whether someone wants texts.
  await supabase.from("entrants").update({ sms_opt_in: prefs.sms }).eq("id", entrant.id);

  revalidatePath("/settings");
  return { ok: true };
}

/** Mark every unread notification read. Called when the bell panel opens —
 * seeing them is what "read" means here. */
export async function markAlertsRead(): Promise<SettingsResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not signed in" };

  // RLS scopes this to the caller's own rows, so no entrant filter is needed
  // here — and adding one that disagreed with the policy would be worse.
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
