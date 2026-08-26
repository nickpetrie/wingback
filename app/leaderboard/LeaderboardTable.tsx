"use client";

import { useState } from "react";
import { Avatar } from "../Avatar";

export type SeasonCell =
  | { state: "empty"; gw: number }
  | { state: "pending"; gw: number; playerCode: number; webName: string }
  | {
      state: "scored" | "blanked";
      gw: number;
      playerCode: number;
      webName: string;
      teamColor: string;
      goals: number;
      stake: 3 | 6;
      hat: boolean;
    };

export interface BoardRow {
  entrant_id: string;
  avatar_updated_at: string | null;
  rank: number;
  name: string;
  stars: number;
  note: string;
  points: number;
  scoring: number;
  album: SeasonCell[];
  summary: string;
}

export function LeaderboardTable({ rows }: { rows: BoardRow[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div>
      {rows.map((row) => (
        <div key={row.entrant_id}>
          <div
            className="wb-row"
            onClick={() => setOpenId((id) => (id === row.entrant_id ? null : row.entrant_id))}
            style={{
              display: "grid",
              gridTemplateColumns: "44px minmax(0,1fr) 90px 90px 24px",
              gap: 16,
              alignItems: "center",
              padding: "16px 0",
              borderBottom: "1px solid var(--color-divider)",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-heading)",
                fontWeight: 800,
                fontSize: 26,
                lineHeight: 1,
                fontVariantNumeric: "tabular-nums",
                color: "color-mix(in srgb, var(--color-text) 35%, transparent)",
              }}
            >
              {row.rank}
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              <Avatar
                entrantId={row.entrant_id}
                name={row.name}
                updatedAt={row.avatar_updated_at}
                size={32}
              />
              <span style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 22, letterSpacing: "-.01em" }}>
                {row.name}
              </span>
              {row.stars > 0 && <span style={{ fontSize: 12 }}>{"★".repeat(row.stars)}</span>}
              {row.note && (
                <span style={{ fontSize: 11, color: "color-mix(in srgb, var(--color-text) 50%, transparent)" }}>
                  {row.note}
                </span>
              )}
            </span>
            <span
              style={{
                fontFamily: "var(--font-heading)",
                fontWeight: 800,
                fontSize: 30,
                lineHeight: 1,
                fontVariantNumeric: "tabular-nums",
                textAlign: "right",
                color: "var(--color-accent)",
              }}
            >
              {row.points}
            </span>
            <span
              style={{
                fontSize: 12,
                textAlign: "right",
                fontVariantNumeric: "tabular-nums",
                color: "color-mix(in srgb, var(--color-text) 55%, transparent)",
              }}
            >
              {row.scoring} GWs
            </span>
            <span style={{ fontSize: 12, color: "color-mix(in srgb, var(--color-text) 45%, transparent)" }}>
              {openId === row.entrant_id ? "▲" : "▼"}
            </span>
          </div>

          {openId === row.entrant_id && (
            <div className="wb-in" style={{ padding: "18px 0 26px", borderBottom: "1px solid var(--color-divider)" }}>
              <p
                style={{
                  margin: "0 0 10px",
                  fontSize: 11,
                  letterSpacing: ".08em",
                  textTransform: "uppercase",
                  color: "color-mix(in srgb, var(--color-text) 55%, transparent)",
                }}
              >
                Season record · 38 gameweeks
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(19,minmax(0,1fr))", gap: 4 }}>
                {row.album.map((cell) => (
                  <SeasonCellView key={cell.gw} cell={cell} />
                ))}
              </div>
              <div style={{ display: "flex", gap: 20, marginTop: 12, flexWrap: "wrap", fontSize: 11, color: "color-mix(in srgb, var(--color-text) 55%, transparent)" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 10, height: 10, background: "var(--color-neutral-500)", display: "block" }} />
                  scored
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 10, height: 10, background: "var(--color-neutral-300)", display: "block" }} />
                  blank
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 10, height: 10, border: "1px dashed var(--color-divider)", display: "block" }} />
                  no pick
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 10, height: 10, background: "var(--color-accent)", display: "block" }} />
                  hat-trick — player unlocked again
                </span>
              </div>
              <p style={{ margin: "12px 0 0", fontSize: 13, color: "color-mix(in srgb, var(--color-text) 65%, transparent)" }}>
                {row.summary}
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function SeasonCellView({ cell }: { cell: SeasonCell }) {
  if (cell.state === "empty") {
    return (
      <div
        style={{
          aspectRatio: "1",
          border: "1px dashed var(--color-divider)",
          display: "grid",
          placeItems: "center",
          position: "relative",
        }}
        title={`GW${cell.gw} — no pick`}
      >
        <span style={{ fontSize: 9, fontVariantNumeric: "tabular-nums", color: "color-mix(in srgb, var(--color-text) 30%, transparent)" }}>
          {cell.gw}
        </span>
      </div>
    );
  }

  if (cell.state === "pending") {
    return (
      <div style={{ aspectRatio: "1", position: "relative", border: "1px solid var(--color-accent)" }} title={`GW${cell.gw} — ${cell.webName}, pending`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- server-posterised card */}
        <img src={`/api/player-image/${cell.playerCode}`} alt={cell.webName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        <span style={{ position: "absolute", left: 2, top: 1, fontSize: 7, fontVariantNumeric: "tabular-nums", color: "rgba(255,255,255,.8)" }}>
          {cell.gw}
        </span>
      </div>
    );
  }

  const title = `GW${cell.gw} — ${cell.webName}, ${cell.goals} goal${cell.goals === 1 ? "" : "s"}${cell.stake === 6 ? " ×2" : ""}${cell.hat ? " — hat-trick, unlocked again" : ""}`;

  return (
    <div
      style={{
        aspectRatio: "1",
        position: "relative",
        outline: cell.hat ? "2px solid var(--color-accent)" : "none",
        outlineOffset: -2,
      }}
      title={title}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- server-posterised card */}
      <img
        src={`/api/player-image/${cell.playerCode}`}
        alt={cell.webName}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          filter: cell.state === "blanked" ? "saturate(.25) brightness(.75)" : "none",
        }}
      />
      <span
        style={{
          position: "absolute",
          left: 2,
          top: 1,
          fontSize: 7,
          fontVariantNumeric: "tabular-nums",
          color: "rgba(255,255,255,.75)",
        }}
      >
        {cell.gw}
      </span>
      {cell.stake === 6 && (
        <span
          style={{
            position: "absolute",
            right: 1,
            bottom: 1,
            fontSize: 7,
            fontWeight: 800,
            fontFamily: "var(--font-heading)",
            color: "#fff",
            background: "rgba(0,0,0,.5)",
            padding: "0 2px",
          }}
        >
          x2
        </span>
      )}
    </div>
  );
}
