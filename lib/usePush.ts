"use client";

import { useCallback, useEffect, useState } from "react";
import { removePushSubscription, savePushSubscription } from "@/app/actions";
import { b64urlToUint8Array, bufferToB64url, needsInstallFirst, pushSupported } from "@/lib/push";

export type PushState =
  | "checking"
  | "unsupported"
  | "needs-install"
  | "blocked"
  | "off"
  | "on"
  | "working";

/** The browser half of push, as one hook.
 *
 * It exists because the settings screen had two controls for one thing: an
 * Alerts switch that recorded a preference, and a "Turn on" button next to it
 * that did the actual subscribing. Two switches for one decision is how a
 * settings screen starts lying about its own state. Now the switch calls this,
 * and there is no button. */
export function usePush() {
  const [state, setState] = useState<PushState>("checking");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      // On iOS the whole API is missing until the app is installed, so the
      // two cases have to be told apart or the message is a lie.
      if (!pushSupported()) {
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
    })();
    return () => {
      live = false;
    };
  }, []);

  const enable = useCallback(async (): Promise<boolean> => {
    setError(null);
    setState("working");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "blocked" : "off");
        return false;
      }

      const reg = await navigator.serviceWorker.register("/sw.js");
      // A just-registered worker isn't controlling the page yet, and
      // subscribing before it's active throws.
      await navigator.serviceWorker.ready;

      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!key) throw new Error("Push isn't configured on this deployment.");

      const sub = await reg.pushManager.subscribe({
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
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setState("off");
      return false;
    }
  }, []);

  const disable = useCallback(async (): Promise<boolean> => {
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
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setState("on");
      return false;
    }
  }, []);

  /** Why push can't be switched on here, or null when it can. */
  const blocker =
    state === "unsupported"
      ? "This browser doesn't support notifications."
      : state === "needs-install"
        ? "Add Wingback to your home screen first — iOS only allows notifications for installed apps."
        : state === "blocked"
          ? "Blocked in your browser settings. Allow notifications for this site, then come back."
          : null;

  return { state, error, blocker, enable, disable };
}
