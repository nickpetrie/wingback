// Runs every 15 minutes. Sends email + push at T-24h and email + push + SMS at
// T-2h to any entrant who has not yet picked for a gameweek.
//
// Idempotency: insert the reminders_sent marker row FIRST. Its primary key
// (entrant_id, gameweek, channel, window_key) rejects a duplicate, which is
// the whole mechanism — no separate "already sent?" check needed. If the
// send itself then fails, delete the marker so the next run retries rather
// than silently swallowing it.
import { serviceClient } from "../_shared/supabase.ts";
import { sendReminderEmail, sendReminderSms } from "../_shared/notify.ts";
import { sendPush, type VapidKeys } from "../_shared/webpush.ts";

type ServiceClient = ReturnType<typeof serviceClient>;
type Window = "t24h" | "t2h";

Deno.serve(async () => {
  try {
    const supabase = serviceClient();
    const now = new Date();

    // Push is optional: without keys configured the other channels carry on.
    const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY");
    const vapid: VapidKeys | null = vapidPublic && vapidPrivate
      ? {
        publicKey: vapidPublic,
        privateKey: vapidPrivate,
        subject: Deno.env.get("VAPID_SUBJECT") ?? "mailto:wingback@example.com",
      }
      : null;

    const { data: gameweeks, error: gwError } = await supabase
      .from("gameweeks")
      .select("id, lock_at")
      .eq("finished", false)
      .not("lock_at", "is", null)
      .gt("lock_at", now.toISOString());
    if (gwError) throw gwError;

    let sent = 0;
    let failed = 0;

    for (const gw of gameweeks ?? []) {
      const lockAt = new Date(gw.lock_at as string);
      const hoursOut = (lockAt.getTime() - now.getTime()) / (60 * 60 * 1000);

      const windows: Window[] = [];
      if (hoursOut <= 24) windows.push("t24h");
      if (hoursOut <= 2) windows.push("t2h");
      if (windows.length === 0) continue;

      const { data: allEntrants, error: entrantsError } = await supabase
        .from("entrants")
        .select("id, email, phone, sms_opt_in");
      if (entrantsError) throw entrantsError;

      const { data: subscriptions, error: subsError } = await supabase
        .from("push_subscriptions")
        .select("endpoint, entrant_id, p256dh, auth");
      if (subsError) throw subsError;

      const { data: picked, error: pickedError } = await supabase
        .from("picks")
        .select("entrant_id")
        .eq("gameweek", gw.id);
      if (pickedError) throw pickedError;

      const pickedIds = new Set((picked ?? []).map((p: { entrant_id: string }) => p.entrant_id));
      const entrants = (allEntrants ?? []).filter((e: { id: string }) => !pickedIds.has(e.id));

      for (const window of windows) {
        for (const entrant of entrants ?? []) {
          // Without this guard an entrant who has never filled in Settings has
          // a null address, Resend rejects it, the marker is rolled back, and
          // the next run tries again — every 15 minutes for the whole window.
          if (entrant.email) {
            const emailSent = await tryChannel(supabase, entrant.id, gw.id, "email", window, () =>
              sendReminderEmail(
                entrant.email,
                `Wingback: pick for gameweek ${gw.id}`,
                `You haven't picked for gameweek ${gw.id} yet. Picks lock at ${lockAt.toISOString()}.`,
              ));
            if (emailSent) sent++; else failed++;
          }

          const mine = (subscriptions ?? []).filter(
            (s: { entrant_id: string }) => s.entrant_id === entrant.id,
          );
          if (vapid && mine.length > 0) {
            const pushed = await tryChannel(supabase, entrant.id, gw.id, "push", window, () =>
              pushToAll(supabase, mine, {
                title: window === "t2h" ? `Picks lock in 2 hours` : `Gameweek ${gw.id} closes tomorrow`,
                body: `You haven't picked for gameweek ${gw.id} yet.`,
                tag: `gw-${gw.id}-reminder`,
                url: "/",
              }, vapid));
            if (pushed) sent++; else failed++;
          }

          if (window === "t2h" && entrant.sms_opt_in && entrant.phone) {
            const smsSent = await tryChannel(supabase, entrant.id, gw.id, "sms", window, () =>
              sendReminderSms(
                entrant.phone,
                `Wingback: pick for gameweek ${gw.id} locks at ${lockAt.toISOString()}. You haven't picked yet.`,
              ));
            if (smsSent) sent++; else failed++;
          }
        }
      }
    }

    return Response.json({ ok: true, sent, failed });
  } catch (err) {
    console.error("remind failed", err);
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
});

interface StoredSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** Deliver to every browser this entrant has registered. Succeeds if any one
 * of them took it — a dead laptop subscription shouldn't mark the whole
 * reminder failed and have it retried on the phone that already buzzed.
 * Subscriptions the push service reports as gone are deleted rather than
 * retried forever. */
async function pushToAll(
  supabase: ServiceClient,
  subs: StoredSubscription[],
  message: { title: string; body: string; tag: string; url: string },
  vapid: VapidKeys,
): Promise<void> {
  const payload = JSON.stringify(message);
  let delivered = 0;

  for (const sub of subs) {
    const result = await sendPush(sub, payload, vapid);
    if (result.ok) {
      delivered++;
      continue;
    }
    if (result.gone) {
      await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      continue;
    }
    console.error(`push to ${sub.endpoint.slice(0, 60)} failed: ${result.error}`);
  }

  if (delivered === 0) throw new Error("no push subscription accepted the message");
}

async function tryChannel(
  supabase: ServiceClient,
  entrantId: string,
  gameweek: number,
  channel: "email" | "sms" | "push",
  window: Window,
  send: () => Promise<void>,
): Promise<boolean> {
  const { error: insertError } = await supabase
    .from("reminders_sent")
    .insert({ entrant_id: entrantId, gameweek, channel, window_key: window });

  if (insertError) {
    // Unique violation: already sent this window/channel. Nothing to do.
    return false;
  }

  try {
    await send();
    return true;
  } catch (err) {
    console.error(`failed to send ${channel} to entrant ${entrantId} for gw ${gameweek}`, err);
    await supabase
      .from("reminders_sent")
      .delete()
      .match({ entrant_id: entrantId, gameweek, channel, window_key: window });
    return false;
  }
}
