"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

const DISMISSED_KEY = "wb-install-dismissed";

interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS predates the standard and still only sets this.
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

/** Nudge to install, which on iOS is also the price of admission for push
 * notifications later — Safari only allows them for a home-screen app.
 *
 * Two different mechanisms: Chrome fires beforeinstallprompt and gives us a
 * real installer to call; Safari has no such event and never will, so all we
 * can do there is point at the Share menu. */
type Mode = "none" | "ios" | "prompt";

/** Which nudge (if any) applies here. Read as an external snapshot rather than
 * set from an effect: it depends on the browser and on storage, neither of
 * which the server can see, and it never changes after load. */
function modeSnapshot(): Mode {
  if (isStandalone()) return "none";
  try {
    if (localStorage.getItem(DISMISSED_KEY) === "1") return "none";
  } catch {
    // Private mode: show it, it's dismissible either way.
  }
  return isIos() ? "ios" : "prompt";
}

const subscribeNothing = () => () => {};
const serverMode = (): Mode => "none";

export function InstallPrompt() {
  const mode = useSyncExternalStore(subscribeNothing, modeSnapshot, serverMode);
  const [deferred, setDeferred] = useState<InstallEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (mode !== "prompt") return;
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, [mode]);

  const showIosHint = mode === "ios" && !dismissed;

  function dismiss() {
    setDeferred(null);
    setDismissed(true);
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Nothing to do — it just asks again next time.
    }
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    dismiss();
  }

  if (dismissed || (!deferred && !showIosHint)) return null;

  return (
    <div className="wb-install wb-in" role="note">
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 14 }}>
          Put Wingback on your home screen
        </p>
        <p style={{ margin: "2px 0 0", fontSize: 12, color: "color-mix(in srgb, var(--color-text) 60%, transparent)" }}>
          {showIosHint ? (
            <>
              Tap Share, then <strong style={{ fontWeight: 600 }}>Add to Home Screen</strong>.
            </>
          ) : (
            "One tap to your picks, no browser chrome."
          )}
        </p>
      </div>
      {deferred && (
        <button type="button" className="btn btn-primary wb-tap" style={{ fontSize: 13 }} onClick={install}>
          Add
        </button>
      )}
      <button
        type="button"
        className="btn btn-ghost wb-tap"
        aria-label="Dismiss"
        style={{ fontSize: 13 }}
        onClick={dismiss}
      >
        Not now
      </button>
    </div>
  );
}
