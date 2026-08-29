// "Send me a test notification" from Settings. Exists because the alternative
// way to see a push is to wait for a real deadline, and a notification system
// you can't try is a notification system nobody trusts.
//
// This is the one function the browser calls directly, so it is deployed with
// verify_jwt *off* and checks the caller itself — see _shared/cors.ts for why
// the gateway's own check makes a cross-origin call impossible. Every path
// below still requires a token, resolves it to an entrant, and only ever
// pushes to that entrant's own subscriptions: the token identifies who you
// are, it doesn't let you pick whose phone buzzes.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsJson, preflight } from "../_shared/cors.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { sendPush, type VapidKeys } from "../_shared/webpush.ts";

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return corsJson({ ok: false, error: "not signed in" }, { status: 401 });

    const publicUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!publicUrl || !anonKey) throw new Error("SUPABASE_URL / SUPABASE_ANON_KEY are not set");

    // Read the caller's identity through *their* token, not the service role.
    const asCaller = createClient(publicUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: { user } } = await asCaller.auth.getUser();
    if (!user) return corsJson({ ok: false, error: "not signed in" }, { status: 401 });

    const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY");
    if (!vapidPublic || !vapidPrivate) {
      return corsJson(
        { ok: false, error: "VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY are not set on this project" },
        { status: 500 },
      );
    }
    const vapid: VapidKeys = {
      publicKey: vapidPublic,
      privateKey: vapidPrivate,
      subject: Deno.env.get("VAPID_SUBJECT") ?? "mailto:wingback@example.com",
    };

    const supabase = serviceClient();
    const { data: entrant } = await supabase
      .from("entrants")
      .select("id, display_name")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    if (!entrant) return corsJson({ ok: false, error: "no claimed profile" }, { status: 403 });

    const { data: subs, error: subsError } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("entrant_id", entrant.id);
    if (subsError) throw subsError;
    if (!subs || subs.length === 0) {
      return corsJson({ ok: false, error: "no subscriptions for this account" }, { status: 404 });
    }

    const payload = JSON.stringify({
      title: "Wingback",
      body: "Test notification — push is working.",
      tag: "wingback-test",
      url: "/settings",
    });

    let delivered = 0;
    const errors: string[] = [];
    for (const sub of subs) {
      const result = await sendPush(sub, payload, vapid);
      if (result.ok) {
        delivered++;
      } else if (result.gone) {
        // Clean up as we go: a test is a good moment to notice a dead endpoint.
        await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        errors.push(`${result.status} (subscription expired, removed)`);
      } else {
        errors.push(result.error ?? String(result.status));
      }
    }

    return corsJson(
      { ok: delivered > 0, delivered, tried: subs.length, errors },
      { status: delivered > 0 ? 200 : 502 },
    );
  } catch (err) {
    console.error("push-test failed", err);
    return corsJson(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
});
