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
    <div className="border-b border-pitch-900/10 bg-cream">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-3 overflow-x-auto px-4 py-2 text-left"
      >
        {rows.map((row, i) => (
          <span
            key={row.entrant_id}
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-white px-3 py-1 text-sm shadow-sm"
          >
            <span>{MEDALS[i] ?? "⚽"}</span>
            <span className="font-medium text-pitch-900">{row.display_name}</span>
            <span className="tabular-nums text-pitch-700">{row.total_points}</span>
          </span>
        ))}
        <span className="ml-auto shrink-0 pl-2 text-xs text-pitch-700/70">
          {expanded ? "hide ▲" : "details ▼"}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-pitch-900/10 px-4 py-3">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-pitch-700/60">
                <th className="py-1 font-medium">Entrant</th>
                <th className="py-1 text-right font-medium">Points</th>
                <th className="py-1 text-right font-medium">Scoring GWs</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.entrant_id} className="border-t border-pitch-900/5">
                  <td className="py-1.5">
                    {MEDALS[i] ? `${MEDALS[i]} ` : ""}
                    {row.display_name}
                  </td>
                  <td className="py-1.5 text-right tabular-nums font-semibold text-pitch-900">
                    {row.total_points}
                  </td>
                  <td className="py-1.5 text-right tabular-nums text-pitch-700/70">
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
