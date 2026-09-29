// Resend (email) and Twilio (SMS) senders. Both read their keys from
// function secrets (`supabase secrets set ...`), never from source.

// Every outbound send gives up after this. `notify` claims its rows before
// it sends, so a provider that accepts the connection and then says nothing
// would otherwise hold the isolate until the platform kills it — with the
// rest of the batch stamped delivered and never sent. A timeout surfaces as
// a thrown error, which the caller already counts as one failed send.
export const SEND_TIMEOUT_MS = 10_000;

export async function sendReminderEmail(to: string, subject: string, text: string) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) throw new Error("RESEND_API_KEY is not set");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: Deno.env.get("REMINDER_FROM_EMAIL") ?? "wingback@resend.dev",
      to,
      subject,
      text,
    }),
  });
  if (!res.ok) {
    throw new Error(`Resend responded ${res.status}: ${await res.text()}`);
  }
}

/** Whether SMS can be sent at all.
 *
 * Callers check this instead of letting the send throw, because "Twilio was
 * never set up" is not a delivery failure — it is a channel that does not
 * exist yet, and counting it as a failure buried the real ones. Someone who
 * has asked for SMS keeps that preference either way: the moment the three
 * secrets are set, they start getting texts with nothing to switch back on. */
export function smsConfigured(): boolean {
  return Boolean(
    Deno.env.get("TWILIO_ACCOUNT_SID") &&
      Deno.env.get("TWILIO_AUTH_TOKEN") &&
      Deno.env.get("TWILIO_FROM_NUMBER"),
  );
}

export async function sendReminderSms(to: string, body: string) {
  const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const token = Deno.env.get("TWILIO_AUTH_TOKEN");
  const from = Deno.env.get("TWILIO_FROM_NUMBER");
  if (!sid || !token || !from) {
    throw new Error("TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM_NUMBER are not set");
  }

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    headers: {
      Authorization: `Basic ${btoa(`${sid}:${token}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: to, From: from, Body: body }),
  });
  if (!res.ok) {
    throw new Error(`Twilio responded ${res.status}: ${await res.text()}`);
  }
}
