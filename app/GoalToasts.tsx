"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { teamColor } from "@/lib/teamColors";
import type { Stake } from "@/lib/supabase/types";

interface Toast {
  id: string;
  headline: string;
  sub: string;
  color: string;
}

interface ConfettiPiece {
  id: number;
  left: number;
  delay: number;
  duration: number;
  color: string;
}

/** Built in the event handler rather than during render: Math.random() in a
 * component body is impure, and two renders disagreeing about where a piece
 * starts is exactly the class of bug React's compiler rejects. */
function makeConfetti(teamColour: string): ConfettiPiece[] {
  const palette = [teamColour, "var(--color-gold)", "var(--color-accent)", "var(--color-text)"];
  return Array.from({ length: 44 }, (_, id) => ({
    id,
    left: Math.random() * 100,
    // Spread over a second so it falls as a shower rather than a curtain.
    delay: Math.random() * 1000,
    duration: 2200 + Math.random() * 1400,
    color: palette[id % palette.length],
  }));
}

/** Someone who has asked their device not to animate things is not opted into
 * this one either. Read at the moment it would fire, not at mount, because
 * the setting can change while a tab is open. */
function motionAllowed(): boolean {
  return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

interface PickRow {
  entrant_id: string;
  player_code: number;
  stake: Stake;
  goals: number;
}

/** Live "X scores" toasts while a gameweek is locked, via a Realtime
 * subscription on picks.goals for that gameweek. FPL's /live/ payload (what
 * the score edge function polls) doesn't surface a goal-minute to this app,
 * so the toast leads with the headline instead of a clock time. */
export function GoalToasts({ gameweekId }: { gameweekId: number | null }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confetti, setConfetti] = useState<ConfettiPiece[] | null>(null);

  useEffect(() => {
    if (!gameweekId) return;
    const supabase = createClient();

    const channel = supabase
      .channel(`gw-${gameweekId}-goals`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "picks", filter: `gameweek=eq.${gameweekId}` },
        (payload) => {
          const oldRow = payload.old as Partial<PickRow>;
          const newRow = payload.new as PickRow;
          const scored = (newRow.goals ?? 0) - (oldRow.goals ?? 0);
          if (scored <= 0) return;

          void (async () => {
            const [{ data: entrant }, { data: player }] = await Promise.all([
              supabase.from("entrants").select("display_name").eq("id", newRow.entrant_id).maybeSingle(),
              supabase
                .from("players")
                .select("web_name, teams(short_name)")
                .eq("code", newRow.player_code)
                .maybeSingle(),
            ]);

            const pts = scored * (newRow.stake === 6 ? 2 : 1);
            const id = `${newRow.entrant_id}-${Date.now()}`;
            const colour = player?.teams?.short_name ? teamColor(player.teams.short_name) : "#605d5d";
            // The third goal, not a third goal: this fires on the update that
            // crosses the line, so a fourth doesn't do it all again.
            const hatTrick = (newRow.goals ?? 0) >= 3 && (oldRow.goals ?? 0) < 3;
            const who = entrant?.display_name ?? "Someone";
            const name = player?.web_name ?? "Goal";

            setToasts((t) =>
              [
                ...t,
                {
                  id,
                  headline: hatTrick ? `${name} — HAT-TRICK` : `${name} scores`,
                  // A hat-trick puts that player back on this entrant's board,
                  // which is a bigger deal than the points and the one thing
                  // they might actually act on.
                  sub: hatTrick
                    ? `${who} — ${pts} pts, and ${name} is theirs to pick again`
                    : `${who}${newRow.stake === 6 ? " ×2" : ""} — ${pts} pt${pts === 1 ? "" : "s"}`,
                  color: colour,
                },
              ].slice(-3),
            );
            setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), hatTrick ? 9000 : 5200);

            if (hatTrick && motionAllowed()) {
              setConfetti(makeConfetti(colour));
              setTimeout(() => setConfetti(null), 4200);
            }
          })();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameweekId]);

  if (toasts.length === 0 && confetti === null) return null;

  return (
    <>
      {confetti && (
        <div className="wb-confetti" aria-hidden="true">
          {confetti.map((piece) => (
            <span
              key={piece.id}
              className="wb-confetti-piece"
              style={{
                left: `${piece.left}%`,
                background: piece.color,
                animationDelay: `${piece.delay}ms`,
                animationDuration: `${piece.duration}ms`,
              }}
            />
          ))}
        </div>
      )}
    <div
      style={{
        position: "fixed",
        right: 24,
        bottom: 24,
        zIndex: 70,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        alignItems: "flex-end",
        pointerEvents: "none",
      }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className="wb-toast"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "12px 16px",
            minWidth: 280,
            background: t.color,
            color: "#fff",
            boxShadow: "var(--shadow-lg)",
          }}
        >
          <span style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 16, lineHeight: 1.2 }}>
              {t.headline}
            </span>
            <span style={{ fontSize: 11, opacity: 0.85 }}>{t.sub}</span>
          </span>
        </div>
      ))}
    </div>
    </>
  );
}
