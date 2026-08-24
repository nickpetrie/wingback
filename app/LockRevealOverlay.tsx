"use client";

import { useEffect, useState } from "react";
import type { GameweekPick } from "@/lib/picks";

/** A once-per-gameweek "final picks are in" moment when someone checks in
 * after the deadline has passed. Picks are visible before lock too now, so
 * this isn't hiding anything — it's just marking the moment the gameweek
 * goes live, gated on localStorage so it doesn't replay every visit. */
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
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-pitch-900/95 p-6 backdrop-blur-sm"
      onClick={dismiss}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-400">
        🔒 Gameweek {gameweekId} locked
      </p>
      <h2 className="text-center text-2xl font-extrabold text-white">Final picks are in</h2>

      <div
        className="flex max-h-[55vh] w-full max-w-sm flex-col gap-2 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {picks.map((p, i) => (
          <div
            key={p.entrant_id}
            className="reveal-card flex items-center justify-between rounded-2xl bg-surface-strong px-4 py-3 opacity-0 shadow-lg backdrop-blur-sm"
            style={{ animationDelay: `${i * 250}ms` }}
          >
            <span className="font-semibold text-foreground">{p.entrant_name}</span>
            <span className="text-sm text-foreground/70">
              {p.player_name} <span className="text-foreground/40">({p.team_short_name})</span>
              {p.stake === 6 ? " ×2" : ""}
            </span>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={dismiss}
        className="rounded-full bg-gold-500 px-6 py-2 text-sm font-semibold text-pitch-900 shadow-sm hover:bg-gold-400"
      >
        Continue →
      </button>
    </div>
  );
}
