import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Where a Supabase magic-link email points. Verifying here (rather than
// trusting the link's own redirect) is what actually establishes the session
// cookie, server-side, over a real Set-Cookie header.
//
// Two shapes arrive at this route and both have to work, because which one
// you get depends on the email template configured in the Supabase
// dashboard, not on anything in this repo:
//
//   ?token_hash=…&type=magiclink   — template uses {{ .TokenHash }}
//   ?code=…                        — template uses {{ .ConfirmationURL }},
//                                    i.e. the PKCE flow the browser client
//                                    starts in app/login
//
// Handling only the first is why a link could land on /auth/error while the
// code in the same email worked fine.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  // Only same-site paths, so a crafted link can't turn a valid magic link
  // into an open redirect.
  const nextParam = searchParams.get("next");
  const next = nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")
    ? nextParam
    : "/";

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, origin));
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(next, origin));
  }

  return NextResponse.redirect(new URL("/auth/error", origin));
}
