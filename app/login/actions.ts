"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export interface AuthResult {
  ok: boolean;
  error?: string;
}

/** The origin this request actually arrived on, so a magic link points back
 * at the same deployment (preview or production) without the browser getting
 * a say in it. */
async function siteOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

/* Both of these run on the server rather than in the browser, and that is
 * the point. A session established from client-side JavaScript is written
 * with document.cookie, which Safari's tracking prevention caps at seven
 * days no matter what expiry we ask for — on an iPhone, and especially in an
 * installed PWA, that is the difference between signing in once a season and
 * signing in once a week. Established here it goes out as a real Set-Cookie
 * header from a first-party response, which is not capped. */

export async function sendMagicLink(email: string): Promise<AuthResult> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${await siteOrigin()}/auth/confirm` },
  });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function verifyLoginCode(email: string, token: string): Promise<AuthResult> {
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  return error ? { ok: false, error: error.message } : { ok: true };
}
