"use client";

import { useMemo, useState } from "react";
import type { PlayerOption } from "@/lib/players";
import { foldDiacritics } from "@/lib/rules";
import { TeamBadge } from "./TeamBadge";

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
    <div style={{ position: "relative" }}>
      <input
        type="text"
        placeholder={placeholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="input"
      />
      {matches.length > 0 && (
        <ul
          style={{
            position: "absolute",
            zIndex: 10,
            marginTop: 1,
            maxHeight: 288,
            width: "100%",
            overflow: "auto",
            border: "1px solid var(--color-divider)",
            borderTop: "none",
            background: "var(--color-bg)",
            boxShadow: "var(--shadow-md)",
            listStyle: "none",
            padding: 0,
          }}
        >
          {matches.map((p) => (
            <li key={p.code}>
              <button
                type="button"
                onClick={() => {
                  onSelect(p);
                  setQuery("");
                }}
                style={{
                  display: "flex",
                  width: "100%",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 14px",
                  textAlign: "left",
                  fontSize: 14,
                  background: "none",
                  border: 0,
                  borderBottom: "1px solid var(--color-divider)",
                  color: "var(--color-text)",
                  cursor: "pointer",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {p.web_name}{" "}
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      color: "color-mix(in srgb, var(--color-text) 55%, transparent)",
                    }}
                  >
                    · <TeamBadge code={p.team_code} size={14} /> {p.team_short_name}
                  </span>
                </span>
                {p.status !== "a" && (
                  <span style={{ fontSize: 12, color: "var(--color-accent-700)" }}>
                    {STATUS_LABEL[p.status] ?? p.status}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
