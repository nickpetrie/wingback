"use client";

import { useEffect, useState } from "react";
import { b64urlToUint8Array, bufferToB64url, needsInstallFirst, pushSupported } from "@/lib/push";
import { createClient } from "@/lib/supabase/client";
import { removePushSubscription, savePushSubscription } from "./actions";

type State = "checking" | "unsupported" | "needs-install" | "off" | "on" | "blocked" | "working";

export function PushToggle() {
  const [state, setState] = useState<State>("checking");
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    async function check() {
      if (!pushSupported()) {
        // On iOS the API is missing until installed, so say which it is.
        if (live) setState(needsInstallFirst() ? "needs-install" : "unsupported");
        return;
      }
      if (needsInstallFirst()) {
        if (live) setState("needs-install");
        return;
      }
      if (Notification.permission === "denied") {
        if (live) setState("blocked");
        return;
      }
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        const existing = await reg?.pushManager.getSubscription();
        if (live) setState(existing ? "on" : "off");
      } catch {
        if (live) setState("off");
      }
    }
    check();
    return () => {
      live = false;
    };
  }, []);

  async function enable() {
    setError(null);
    setState("working");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "blocked" : "off");
        return;
      }

      const reg = await navigator.serviceWorker.register("/sw.js");
      // A just-registered worker isn't controlling the page yet; subscribing
      // before it's active throws.
      await navigator.serviceWorker.ready;

      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!key) throw new Error("Push isn't configured on this deployment.");

      const sub = await reg.pushManager.subscribe({
        // Chrome refuses a subscription without a payload key anyway, and the
        // spec requires the flag to be explicit.
        userVisibleOnly: true,
        applicationServerKey: b64urlToUint8Array(key) as BufferSource,
      });

      const result = await savePushSubscription({
        endpoint: sub.endpoint,
        p256dh: bufferToB64url(sub.getKey("p256dh")),
        auth: bufferToB64url(sub.getKey("auth")),
      });
      if (!result.ok) throw new Error(result.error ?? "Could not save.");

      setState("on");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setState("off");
    }
  }

  /** Fires a real push through the same code path a reminder uses, so a pass
   * here means the whole chain works — not just that permission was granted. */
  async function sendTest() {
    setTestResult(null);
    setError(null);
    try {
      const supabase = createClient();
      const { data, error: fnError } = await supabase.functions.invoke("push-test");
      if (fnError) throw fnError;
      const result = data as { ok?: boolean; delivered?: number; errors?: string[] };
      setTestResult(
        result?.ok
          ? `Sent to ${result.delivered} device${result.delivered === 1 ? "" : "s"}.`
          : `Failed: ${result?.errors?.join("; ") ?? "unknown"}`,
      );
    } catch (err) {
      setTestResult(`Failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function disable() {
    setError(null);
    setState("working");
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await removePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setState("on");
    }
  }

  const note = {
    checking: "",
    unsupported: "This browser doesn't support notifications.",
    "needs-install":
      "Add Wingback to your home screen first — iOS only allows notifications for installed apps.",
    blocked: "Blocked in your browser settings. Allow notifications for this site, then come back.",
    off: "A nudge before the deadline if you haven't picked.",
    on: "On for this device. Turn it on separately on any other phone or laptop.",
    working: "",
  }[state];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        {(state === "off" || state === "on" || state === "working") && (
          <button
            type="button"
            className="btn btn-secondary wb-tap"
            onClick={state === "on" ? disable : enable}
            disabled={state === "working"}
          >
            {state === "working" ? "…" : state === "on" ? "Turn off" : "Turn on"}
          </button>
        )}
        {state === "on" && (
          <>
            <button type="button" className="btn btn-ghost wb-tap" style={{ fontSize: 13 }} onClick={sendTest}>
              Send a test
            </button>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12 }}>
              <span aria-hidden="true" style={{ color: "var(--color-accent)", fontSize: 13 }}>
                &#10003;
              </span>
              Enabled
            </span>
          </>
        )}
      </div>
      {note && (
        <p style={{ margin: "8px 0 0", fontSize: 12, color: "color-mix(in srgb, var(--color-text) 55%, transparent)" }}>
          {note}
        </p>
      )}
      {testResult && (
        <p style={{ margin: "6px 0 0", fontSize: 12, color: "color-mix(in srgb, var(--color-text) 60%, transparent)" }}>
          {testResult}
        </p>
      )}
      {error && <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--color-accent-700)" }}>{error}</p>}
    </div>
  );
}
