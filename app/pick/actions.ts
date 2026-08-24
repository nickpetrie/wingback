"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentEntrantId } from "@/lib/entrant";

export interface SubmitPickResult {
  ok: boolean;
  error?: string;
}

export async function submitPick(
  gameweek: number,
  playerCode: number,
  stake: 3 | 6,
): Promise<SubmitPickResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not signed in" };

  const entrantId = await getCurrentEntrantId(supabase, user.id);
  if (!entrantId) return { ok: false, error: "no claimed profile" };

  // Deliberately not .upsert(): an upsert's BEFORE INSERT trigger still
  // fires for the candidate row even when it resolves via ON CONFLICT DO
  // UPDATE, which would make picks_guard re-run the once-per-season reuse
  // check as if this were a brand new usage. Insert or update explicitly
  // so exactly one trigger path fires.
  const { data: existing, error: fetchError } = await supabase
    .from("picks")
    .select("id")
    .eq("gameweek", gameweek)
    .eq("entrant_id", entrantId)
    .maybeSingle();
  if (fetchError) return { ok: false, error: fetchError.message };

  const result = existing
    ? await supabase
      .from("picks")
      .update({ player_code: playerCode, stake })
      .eq("id", existing.id)
    : await supabase
      .from("picks")
      .insert({ entrant_id: entrantId, gameweek, player_code: playerCode, stake });

  if (result.error) return { ok: false, error: result.error.message };

  revalidatePath("/pick");
  revalidatePath("/album");
  revalidatePath("/leaderboard");
  return { ok: true };
}

export async function submitSubstitution(
  pickId: number,
  newPlayerCode: number,
): Promise<SubmitPickResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("picks")
    .update({ player_code: newPlayerCode, is_substitution: true })
    .eq("id", pickId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/pick");
  revalidatePath("/album");
  return { ok: true };
}
