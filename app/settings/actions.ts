"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface SettingsResult {
  ok: boolean;
  error?: string;
}

export async function updatePhone(phone: string, smsOptIn: boolean): Promise<SettingsResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not signed in" };

  const trimmed = phone.trim();
  const { error } = await supabase
    .from("entrants")
    .update({ phone: trimmed.length > 0 ? trimmed : null, sms_opt_in: trimmed.length > 0 && smsOptIn })
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
  revalidatePath("/pick");
  return { ok: true };
}
