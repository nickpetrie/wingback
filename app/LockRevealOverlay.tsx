"use client";

import { useEffect, useState } from "react";
import type { GameweekPick } from "@/lib/picks";
import { teamColor } from "@/lib/teamColors";

/** A once-per-gameweek "final picks are in" moment when someone checks in
 * after the deadline has passed. Picks are visible before lock too now, so
 * this isn't hiding anything — it's just marking the moment the gameweek
 * goes live, gated on localStorage so it doesn't replay every visit. Global
 * chrome (mounted from Nav.tsx), so it can surface over whichever screen
 * the entrant happens to be on when the lock lands. */
export function LockRevealOverlay({
  gameweekId,
  picks,
}: {
  gameweekId: number;
  picks: GameweekPick[];
}) {
  const [visible, setVisible] = useState(false);
  const storageKey = `wingback:reveal-seen:${gameweekId}`;

  useEffect(() => {
    if (picks.length === 0) return;
    let alreadySeen = true;
    try {
      alreadySeen = !!localStorage.getItem(storageKey);
    } catch {
      // localStorage unavailable (private mode etc.) — just skip the moment.
    }
    if (alreadySeen) return;
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, [storageKey, picks.length]);

  function dismiss() {
    setVisible(false);
    try {
      localStorage.setItem(storageKey, "1");
    } catch {
      // ignore — worst case it replays next visit
    }
  }

  if (!visible) return null;

  return (
    <div className="dialog-backdrop" style={{ zIndex: 60 }} onClick={dismiss}>
      <div
        className="wb-in"
        style={{ width: "min(560px,100%)", background: "var(--color-bg)", boxShadow: "var(--shadow-lg)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ background: "var(--color-accent)", color: "var(--color-bg)", padding: "20px 24px" }}>
          <p style={{ margin: 0, fontSize: 10, letterSpacing: ".18em", textTransform: "uppercase", opacity: 0.85 }}>
            Gameweek {gameweekId} · locked
          </p>
          <p style={{ margin: "4px 0 0", fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 34, lineHeight: 1.05, letterSpacing: "-.02em" }}>
            Final picks are in.
          </p>
        </div>
        <div style={{ padding: "8px 24px 20px" }}>
          {picks.map((p, i) => (
            <div
              key={p.entrant_id}
              className="wb-in"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "11px 0",
                borderBottom: "1px solid var(--color-divider)",
                animationDelay: `${i * 140}ms`,
              }}
            >
              <span style={{ width: 8, height: 28, background: teamColor(p.team_short_name), flex: "none" }} />
              <span
                style={{
                  fontSize: 12,
                  letterSpacing: ".06em",
                  textTransform: "uppercase",
                  color: "color-mix(in srgb, var(--color-text) 55%, transparent)",
                  width: 96,
                }}
              >
                {p.entrant_name.split(" ")[0]}
              </span>
              <span style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 19 }}>{p.player_name}</span>
              <span style={{ marginLeft: "auto", fontSize: 12, color: "color-mix(in srgb, var(--color-text) 55%, transparent)" }}>
                {p.team_short_name}
                {p.stake === 6 ? " · ×2" : ""}
              </span>
            </div>
          ))}
          <button type="button" className="btn btn-primary wb-tap" style={{ marginTop: 18 }} onClick={dismiss}>
            No going back now
          </button>
        </div>
      </div>
    </div>
  );
}
