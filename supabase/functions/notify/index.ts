// The one place anything leaves the building.
//
// Every alert in the app — a goal, a pick, injury news, a reminder, a
// gameweek settling — is written to `notifications` by a trigger or by the
// remind function. This picks up the ones nobody has dispatched yet and sends
// each to whichever channels its owner has switched on.
//
// The in-app feed is not a channel here: the row *is* the feed, and it exists
// whether or not any of this works. That is deliberate — email needs a
// provider key, SMS needs a number, push needs an installed PWA — so the
// channel that cannot fail is the one that needs no configuration at all.
import { serviceClient } from "../_shared/supabase.ts";
import { sendReminderEmail, sendReminderSms } from "../_shared/notify.ts";
import { sendPush, type VapidKeys } from "../_shared/webpush.ts";

// Anything older than this on a first run is history, not news. Without it,
// switching the dispatcher on for the first time would post every alert ever
// recorded to five phones at once.
const MAX_AGE_MINUTES = 60;

interface Row {
  id: number;
  entrant_id: string;
  kind: string;
  title: string;
  body: string;
  url: string;
}

Deno.serve(async () => {
  try {
    const supabase = serviceClient();
    const since = new Date(Date.now() - MAX_AGE_MINUTES * 60 * 1000).toISOString();

    const { data: pending, error: pendingError } = await supabase
      .from("notifications")
      .select("id, entrant_id, kind, title, body, url")
      .is("delivered_at", null)
      .gte("created_at", since)
      .order("created_at", { ascending: true })
      .limit(100);
    if (pendingError) throw pendingError;

    if (!pending || pending.length === 0) {
      // Still stamp anything too old to send, or it is reconsidered forever.
      await supabase
        .from("notifications")
        .update({ delivered_at: new Date().toISOString() })
        .is("delivered_at", null)
        .lt("created_at", since);
      return Response.json({ ok: true, delivered: 0 });
    }

    const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY");
    const vapid: VapidKeys | null = vapidPublic && vapidPrivate
      ? {
        publicKey: vapidPublic,
        privateKey: vapidPrivate,
        subject: Deno.env.get("VAPID_SUBJECT") ?? "mailto:wingback@example.com",
      }
      : null;

    const entrantIds = [...new Set(pending.map((n: Row) => n.entrant_id))];

    const [{ data: prefs }, { data: people }, { data: subs }] = await Promise.all([
      supabase.from("alert_prefs").select("*").in("entrant_id", entrantIds),
      supabase.from("entrants").select("id, email, phone").in("id", entrantIds),
      supabase.from("push_subscriptions").select("endpoint, entrant_id, p256dh, auth"),
    ]);

    const prefsBy = new Map((prefs ?? []).map((p: { entrant_id: string }) => [p.entrant_id, p]));
    const personBy = new Map((people ?? []).map((p: { id: string }) => [p.id, p]));

    let emailed = 0;
    let texted = 0;
    let pushed = 0;
    let failed = 0;

    for (const note of pending as Row[]) {
      const pref = prefsBy.get(note.entrant_id);
      const person = personBy.get(note.entrant_id);
      if (!pref || !person) continue;

      if (pref.email && person.email) {
        try {
          await sendReminderEmail(person.email, `Wingback: ${note.title}`, note.body);
          emailed++;
        } catch (err) {
          failed++;
          console.error(`email to ${note.entrant_id} failed`, err);
        }
      }

      // SMS is the one that costs money per message, so it is held back for
      // the alerts you would actually want to be interrupted by.
      if (pref.sms && person.phone && (note.kind === "pick_reminder" || note.kind === "goal")) {
        try {
          await sendReminderSms(person.phone, `${note.title}. ${note.body}`);
          texted++;
        } catch (err) {
          failed++;
          console.error(`sms to ${note.entrant_id} failed`, err);
        }
      }

      if (pref.push && vapid) {
        const mine = (subs ?? []).filter(
          (s: { entrant_id: string }) => s.entrant_id === note.entrant_id,
        );
        for (const sub of mine) {
          const result = await sendPush(
            sub,
            JSON.stringify({
              title: note.title,
              body: note.body,
              tag: `wb-${note.kind}`,
              url: note.url,
            }),
            vapid,
          );
          if (result.ok) {
            pushed++;
          } else if (result.gone) {
            // The browser threw the subscription away — uninstalled, cleared
            // site data, permission revoked. Retrying it forever helps nobody.
            await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
          } else {
            failed++;
            console.error(`push to ${note.entrant_id} failed: ${result.error}`);
          }
        }
      }
    }

    // Stamped whatever happened above. delivered_at means "the dispatcher has
    // considered this row", not "someone received it": marking only successes
    // is how the old reminder ended up retrying an unsendable address every
    // fifteen minutes for a whole gameweek.
    const { error: stampError } = await supabase
      .from("notifications")
      .update({ delivered_at: new Date().toISOString() })
      .in("id", (pending as Row[]).map((n) => n.id));
    if (stampError) throw stampError;

    return Response.json({ ok: true, considered: pending.length, emailed, texted, pushed, failed });
  } catch (err) {
    console.error("notify failed", err);
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
});
