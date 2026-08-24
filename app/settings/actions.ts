"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface SettingsResult {
  ok: boolean;
  error?: string;
}

export async function updateDisplayName(displayName: string): Promise<SettingsResult> {
  const trimmed = displayName.trim();
  if (trimmed.length === 0) return { ok: false, error: "Name can't be empty" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not signed in" };

  const { error } = await supabase
    .from("entrants")
    .update({ display_name: trimmed })
    .eq("id", user.id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
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
    .eq("id", user.id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings");
  revalidatePath("/pick");
  return { ok: true };
}
