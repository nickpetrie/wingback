"use client";

import { useState } from "react";

export interface LeaderboardRow {
  entrant_id: string;
  display_name: string;
  total_points: number;
  scoring_gameweeks: number;
}

const MEDALS = ["🥇", "🥈", "🥉"];

export function LeaderboardStrip({ rows }: { rows: LeaderboardRow[] }) {
  const [expanded, setExpanded] = useState(false);

  if (rows.length === 0) return null;

  return (
    <div className="border-b border-foreground/10 bg-black/20 backdrop-blur-sm">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-3 overflow-x-auto px-4 py-2 text-left"
      >
        {rows.map((row, i) => (
          <span
            key={row.entrant_id}
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-surface px-3 py-1 text-sm shadow-sm"
          >
            <span>{MEDALS[i] ?? "⚽"}</span>
            <span className="font-medium text-foreground">{row.display_name}</span>
            <span className="tabular-nums text-gold-400">{row.total_points}</span>
          </span>
        ))}
        <span className="ml-auto shrink-0 pl-2 text-xs text-foreground/50">
          {expanded ? "hide ▲" : "details ▼"}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-foreground/10 px-4 py-3">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-foreground/40">
                <th className="py-1 font-medium">Entrant</th>
                <th className="py-1 text-right font-medium">Points</th>
                <th className="py-1 text-right font-medium">Scoring GWs</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.entrant_id} className="border-t border-foreground/5">
                  <td className="py-1.5 text-foreground">
                    {MEDALS[i] ? `${MEDALS[i]} ` : ""}
                    {row.display_name}
                  </td>
                  <td className="py-1.5 text-right tabular-nums font-semibold text-gold-400">
                    {row.total_points}
                  </td>
                  <td className="py-1.5 text-right tabular-nums text-foreground/50">
                    {row.scoring_gameweeks}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
