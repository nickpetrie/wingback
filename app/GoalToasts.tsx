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
            setToasts((t) =>
              [
                ...t,
                {
                  id,
                  headline: `${player?.web_name ?? "Goal"} scores`,
                  sub: `${entrant?.display_name ?? "Someone"}${newRow.stake === 6 ? " ×2" : ""} — ${pts} pt${pts === 1 ? "" : "s"}`,
                  color: player?.teams?.short_name ? teamColor(player.teams.short_name) : "#605d5d",
                },
              ].slice(-3),
            );
            setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5200);
          })();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameweekId]);

  if (toasts.length === 0) return null;

  return (
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
  );
}
