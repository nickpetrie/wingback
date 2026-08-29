"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

/** Fires a real push through the same code path an alert uses, so a pass here
 * means the whole chain works — VAPID keys, the encryption, the subscription,
 * the service worker — not merely that permission was granted. Worth keeping
 * precisely because a push that fails to decrypt is dropped silently. */
export function PushTest() {
  const [result, setResult] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function send() {
    setSending(true);
    setResult(null);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.functions.invoke("push-test");
      if (error) throw error;
      const body = data as { ok?: boolean; delivered?: number; errors?: string[] };
      setResult(
        body?.ok
          ? `Sent to ${body.delivered} device${body.delivered === 1 ? "" : "s"}.`
          : `Failed: ${body?.errors?.join("; ") ?? "unknown"}`,
      );
    } catch (err) {
      setResult(`Failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="wb-push-test">
      <button type="button" className="btn btn-secondary wb-tap" onClick={send} disabled={sending}>
        {sending ? "Sending…" : "Send a test push"}
      </button>
      {result && <span className="wb-alert-note">{result}</span>}
    </div>
  );
}
