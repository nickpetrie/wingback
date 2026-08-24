"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface OnboardingResult {
  ok: boolean;
  error?: string;
}

export async function finishOnboarding(phone: string, smsOptIn: boolean): Promise<OnboardingResult> {
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
  redirect("/pick");
}

export async function skipOnboarding() {
  redirect("/pick");
}
