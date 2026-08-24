"use client";

import { useMemo, useState } from "react";
import type { PlayerOption } from "@/lib/players";
import { foldDiacritics } from "@/lib/rules";

export const STATUS_LABEL: Record<string, string> = {
  a: "Available",
  d: "Doubtful",
  i: "Injured",
  s: "Suspended",
  u: "Unavailable",
  n: "Not in squad",
};

/** Diacritic-insensitive player search box with a dropdown of matches. */
export function PlayerSearchInput({
  players,
  placeholder = "Search players…",
  onSelect,
}: {
  players: PlayerOption[];
  placeholder?: string;
  onSelect: (player: PlayerOption) => void;
}) {
  const [query, setQuery] = useState("");

  const matches = useMemo(() => {
    const needle = foldDiacritics(query.trim());
    if (needle.length === 0) return [];
    return players
      .filter((p) => foldDiacritics(`${p.full_name} ${p.web_name} ${p.team_short_name}`).includes(needle))
      .slice(0, 20);
  }, [query, players]);

  return (
    <div className="relative">
      <input
        type="text"
        placeholder={placeholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full rounded-full border border-pitch-900/15 bg-white px-4 py-2.5 text-sm shadow-sm focus:border-pitch-500 focus:outline-none focus:ring-2 focus:ring-pitch-500/20"
      />
      {matches.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-pitch-900/10 bg-white shadow-lg">
          {matches.map((p) => (
            <li key={p.code}>
              <button
                type="button"
                onClick={() => {
                  onSelect(p);
                  setQuery("");
                }}
                className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-pitch-50"
              >
                <span>
                  {p.web_name} <span className="text-pitch-900/40">· {p.team_short_name}</span>
                </span>
                {p.status !== "a" && (
                  <span className="text-xs text-gold-600">{STATUS_LABEL[p.status] ?? p.status}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
