"use client";

import { useState, useSyncExternalStore } from "react";

type ShareSupport = "unsupported" | "supported";

// A capability of the browser, not of anything that changes at runtime —
// same reasoning as InstallPrompt's mode check: read once as an external
// snapshot rather than from an effect, since the server can't see it and it
// never changes after load.
function shareSupport(): ShareSupport {
  if (typeof navigator === "undefined" || !("share" in navigator) || !("canShare" in navigator)) {
    return "unsupported";
  }
  try {
    // Feeding canShare a real (if empty) File is what actually exercises the
    // "can this share files at all" question — some browsers implement
    // navigator.share for links/text only and would happily accept a probe
    // object shaped differently.
    const probe = new File([""], "probe.png", { type: "image/png" });
    return navigator.canShare({ files: [probe] }) ? "supported" : "unsupported";
  } catch {
    return "unsupported";
  }
}

const subscribeNothing = () => () => {};
const serverSupport = (): ShareSupport => "unsupported";

/** The gameweek's team sheet, with a one-tap share to the WhatsApp group —
 * the actual point of the image. There's no way to post to a group
 * automatically (see CLAUDE.md-adjacent brief: the Cloud API has no
 * group-send endpoint, and the alternative is a WhatsApp Web session in
 * breach of its terms), so "one tap" is the whole target: open this, hit
 * Share, pick the group.
 *
 * Where the Web Share API can't share files, this shows the image with a
 * plain save instruction instead of a button that would just fail — the
 * same posture `usePush` takes with "blocked"/"needs-install": tell people
 * what's true, don't dangle a control that doesn't work. */
export function TeamSheetCard({ gameweekId }: { gameweekId: number }) {
  const support = useSyncExternalStore(subscribeNothing, shareSupport, serverSupport);
  const [status, setStatus] = useState<"idle" | "sharing" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const src = `/api/team-sheet/${gameweekId}`;

  async function share() {
    setStatus("sharing");
    setError(null);
    try {
      const res = await fetch(src);
      if (!res.ok) throw new Error("Couldn't load the team sheet.");
      const blob = await res.blob();
      const file = new File([blob], `wingback-gw${gameweekId}.png`, { type: "image/png" });

      if (!navigator.canShare({ files: [file] })) {
        throw new Error("This browser can't share images.");
      }
      await navigator.share({ files: [file], title: `Wingback — Gameweek ${gameweekId}` });
      setStatus("idle");
    } catch (err) {
      // The user closing the share sheet without picking anyone isn't a
      // failure — it's the same as never having tapped the button.
      if (err instanceof DOMException && err.name === "AbortError") {
        setStatus("idle");
        return;
      }
      setStatus("error");
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <section className="wb-team-sheet">
      <div className="wb-team-sheet-head">
        <h6 style={{ margin: 0 }}>Team of the week</h6>
        <span className="wb-team-sheet-note">Gameweek {gameweekId} is locked — share the five picks</span>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element -- server-composited PNG, not eligible for next/image */}
      <img className="wb-team-sheet-img" src={src} alt={`Gameweek ${gameweekId} team sheet`} />
      {support === "supported" ? (
        <>
          <button
            type="button"
            className="btn btn-primary wb-tap"
            onClick={share}
            disabled={status === "sharing"}
          >
            {status === "sharing" ? "Preparing…" : "Share to WhatsApp"}
          </button>
          {status === "error" && <span className="wb-team-sheet-error">{error}</span>}
        </>
      ) : (
        <p className="wb-team-sheet-note">
          Press and hold the image to save it, then share it from your photos.
        </p>
      )}
    </section>
  );
}
