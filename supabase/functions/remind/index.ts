// Runs every 15 minutes. Sends email at T-24h and email+SMS at T-2h to any
// entrant who has not yet picked for a gameweek.
//
// Idempotency: insert the reminders_sent marker row FIRST. Its primary key
// (entrant_id, gameweek, channel, window_key) rejects a duplicate, which is
// the whole mechanism — no separate "already sent?" check needed. If the
// send itself then fails, delete the marker so the next run retries rather
// than silently swallowing it.
import { serviceClient } from "../_shared/supabase.ts";
import { sendReminderEmail, sendReminderSms } from "../_shared/notify.ts";

type ServiceClient = ReturnType<typeof serviceClient>;
type Window = "t24h" | "t2h";

Deno.serve(async () => {
  try {
    const supabase = serviceClient();
    const now = new Date();

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

      const { data: picked, error: pickedError } = await supabase
        .from("picks")
        .select("entrant_id")
        .eq("gameweek", gw.id);
      if (pickedError) throw pickedError;

      const pickedIds = new Set((picked ?? []).map((p: { entrant_id: string }) => p.entrant_id));
      const entrants = (allEntrants ?? []).filter((e: { id: string }) => !pickedIds.has(e.id));

      for (const window of windows) {
        for (const entrant of entrants ?? []) {
          const emailSent = await tryChannel(supabase, entrant.id, gw.id, "email", window, () =>
            sendReminderEmail(
              entrant.email,
              `Wingback: pick for gameweek ${gw.id}`,
              `You haven't picked for gameweek ${gw.id} yet. Picks lock at ${lockAt.toISOString()}.`,
            ));
          if (emailSent) sent++; else failed++;

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

async function tryChannel(
  supabase: ServiceClient,
  entrantId: string,
  gameweek: number,
  channel: "email" | "sms",
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
