// Runs every 15 minutes. Nudges anyone who hasn't picked yet, three times a
// gameweek:
//
//   open      — the first run after the previous gameweek finished
//   midpoint  — midday UK on the day halfway between then and the deadline
//   t1h       — the last hour before the lock
//
// It no longer sends anything itself. It writes a notification row, and the
// `notify` function delivers that to whichever channels the entrant has on.
// One path for every alert in the app means "did I get told?" has one place
// to look, and the reminder can't drift out of step with the rest.
//
// Idempotency is still reminders_sent: insert the marker FIRST, and let its
// primary key reject the duplicate. Since the write is now a local insert
// rather than a call to Resend, there is no failure to roll back — which is
// what used to have this retrying a null email address every fifteen minutes.
import { serviceClient } from "../_shared/supabase.ts";

type Window = "open" | "midpoint" | "t1h";

const UK = "Europe/London";

/** Midday UK on a given date, as an absolute instant. Built by asking the
 * formatter what 12:00 UK looks like rather than assuming an offset, since
 * this has to be right on both sides of the October clock change. */
function middayUk(day: Date): Date {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: UK,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(day);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  const noonUtc = new Date(`${get("year")}-${get("month")}-${get("day")}T12:00:00Z`);
  // How far UK time is from UTC on that date, applied back so the instant
  // really is local midday.
  const offsetMs =
    new Date(noonUtc.toLocaleString("en-US", { timeZone: "UTC" })).getTime() -
    new Date(noonUtc.toLocaleString("en-US", { timeZone: UK })).getTime();
  return new Date(noonUtc.getTime() + offsetMs);
}

Deno.serve(async () => {
  try {
    const supabase = serviceClient();
    const now = new Date();

    // The current gameweek is the earliest unfinished one — the same rule the
    // app uses. Reminding people about a gameweek that is already being
    // played is noise, and reminding them about the one after it is early.
    const { data: gameweeks, error: gwError } = await supabase
      .from("gameweeks")
      .select("id, lock_at, finished")
      .eq("finished", false)
      .order("id", { ascending: true })
      .limit(1);
    if (gwError) throw gwError;

    const gw = gameweeks?.[0];
    if (!gw?.lock_at) return Response.json({ ok: true, reason: "no scheduled gameweek", sent: 0 });

    const lockAt = new Date(gw.lock_at);
    if (lockAt <= now) return Response.json({ ok: true, reason: "locked", sent: 0 });

    // "Since the last deadline" is what a gameweek being open means here.
    const { data: previous } = await supabase
      .from("gameweeks")
      .select("lock_at")
      .lt("id", gw.id)
      .not("lock_at", "is", null)
      .order("id", { ascending: false })
      .limit(1);
    const openedAt = previous?.[0]?.lock_at
      ? new Date(previous[0].lock_at as string)
      : new Date(lockAt.getTime() - 7 * 24 * 60 * 60 * 1000);

    const windows: Window[] = ["open"];
    const midpoint = middayUk(new Date((openedAt.getTime() + lockAt.getTime()) / 2));
    if (now >= midpoint) windows.push("midpoint");
    if (lockAt.getTime() - now.getTime() <= 60 * 60 * 1000) windows.push("t1h");

    const [{ data: entrants, error: entrantsError }, { data: picked, error: pickedError }] =
      await Promise.all([
        supabase.from("alert_prefs").select("entrant_id").eq("pick_reminders", true),
        supabase.from("picks").select("entrant_id").eq("gameweek", gw.id),
      ]);
    if (entrantsError) throw entrantsError;
    if (pickedError) throw pickedError;

    const pickedIds = new Set((picked ?? []).map((p: { entrant_id: string }) => p.entrant_id));
    const owing = (entrants ?? []).filter(
      (e: { entrant_id: string }) => !pickedIds.has(e.entrant_id),
    );

    const hoursLeft = Math.round((lockAt.getTime() - now.getTime()) / (60 * 60 * 1000));
    let sent = 0;

    for (const window of windows) {
      for (const entrant of owing) {
        // The marker is the lock. If it's already there, this window has been
        // done for this entrant and there is nothing to do.
        const { error: markerError } = await supabase
          .from("reminders_sent")
          .insert({
            entrant_id: entrant.entrant_id,
            gameweek: gw.id,
            channel: "email",
            window_key: window,
          });
        if (markerError) continue;

        const { error: noteError } = await supabase.from("notifications").insert({
          entrant_id: entrant.entrant_id,
          kind: "pick_reminder",
          title:
            window === "t1h"
              ? `Gameweek ${gw.id} locks within the hour`
              : window === "open"
                ? `Gameweek ${gw.id} is open`
                : `Still no pick for gameweek ${gw.id}`,
          body:
            window === "t1h"
              ? `Last chance to pick for gameweek ${gw.id}.`
              : `You haven't picked for gameweek ${gw.id} yet — about ${hoursLeft} hours left.`,
          url: "/",
        });
        if (noteError) {
          // Put the marker back so the next run tries again, rather than
          // recording a reminder that was never written.
          await supabase.from("reminders_sent").delete().match({
            entrant_id: entrant.entrant_id,
            gameweek: gw.id,
            channel: "email",
            window_key: window,
          });
          continue;
        }
        sent++;
      }
    }

    return Response.json({ ok: true, gameweek: gw.id, windows, owing: owing.length, sent });
  } catch (err) {
    console.error("remind failed", err);
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
});
