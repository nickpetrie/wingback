/** The push service hands out keys as ArrayBuffers and expects the VAPID key as
 * a Uint8Array, so both directions need converting by hand. */
export function b64urlToUint8Array(value: string): Uint8Array {
  const padded = value.padEnd(value.length + ((4 - (value.length % 4)) % 4), "=");
  const raw = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export function bufferToB64url(buffer: ArrayBuffer | null): string {
  if (!buffer) return "";
  let s = "";
  for (const byte of new Uint8Array(buffer)) s += String.fromCharCode(byte);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** iOS only allows push for an installed app, and says nothing useful if you
 * ask from Safari — so tell people the actual prerequisite instead. */
export function needsInstallFirst(): boolean {
  if (typeof window === "undefined") return false;
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return isIos && !standalone;
}
