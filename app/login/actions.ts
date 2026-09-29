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

// Five people, all of whom already exist in auth. Left at its default,
// signInWithOtp creates an account for any address typed into the form — a
// stranger with the URL would get a real session and a seat on /claim. The
// project-level "Allow new users to sign up" switch (DEPLOY.md §1) is the
// second copy of the same rule, so a redeploy of this file cannot undo it.
const NOT_ONE_OF_US = "That address isn't one of the five. Ask whoever runs the sweepstake.";

export async function sendMagicLink(email: string): Promise<AuthResult> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${await siteOrigin()}/auth/confirm`, shouldCreateUser: false },
  });
  if (!error) return { ok: true };
  // `otp_disabled` is what GoTrue answers when shouldCreateUser is false and
  // the address is unknown ("Signups not allowed for otp"); `signup_disabled`
  // is the dashboard switch saying the same thing. Both read as a broken
  // login to the one person who should never see either.
  const unknownAddress = error.code === "otp_disabled" || error.code === "signup_disabled" ||
    /signups? not allowed/i.test(error.message);
  return { ok: false, error: unknownAddress ? NOT_ONE_OF_US : error.message };
}

export async function verifyLoginCode(email: string, token: string): Promise<AuthResult> {
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  return error ? { ok: false, error: error.message } : { ok: true };
}
