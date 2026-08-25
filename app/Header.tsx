"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { CurrentGameweek } from "@/lib/gameweek";
import { Avatar } from "./Avatar";
import { Countdown } from "./pick/Countdown";
import { GoalToasts } from "./GoalToasts";
import { signOut } from "./actions";

export interface StandingRow {
  entrant_id: string;
  display_name: string;
  total_points: number;
  stars: number;
}

const MENU = [
  { href: "/", label: "Home" },
  { href: "/pick", label: "Pick" },
  { href: "/leaderboard", label: "The table" },
  { href: "/settings", label: "Settings" },
];

export function Header({
  gameweek,
  entrantId,
  standings,
}: {
  gameweek: CurrentGameweek | null;
  entrantId: string;
  standings: StandingRow[];
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const sorted = [...standings].sort((a, b) => b.total_points - a.total_points);

  return (
    <header style={{ position: "sticky", top: 0, zIndex: 30, background: "var(--color-bg)" }}>
      <div style={{ padding: "14px 24px 12px", maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <Link
            href="/"
            style={{
              fontFamily: "var(--font-heading)",
              fontWeight: 800,
              fontSize: 20,
              letterSpacing: "-.02em",
              color: "var(--color-accent)",
              textDecoration: "none",
            }}
          >
            WINGBACK
          </Link>

          <span style={{ display: "flex", alignItems: "center", gap: 8, flex: "none" }}>
            <button
              type="button"
              className="btn btn-ghost wb-tap"
              style={{ fontSize: 12 }}
              onClick={() => signOut()}
            >
              Sign out
            </button>
            <button
              type="button"
              className="btn btn-secondary wb-tap"
              style={{ fontSize: 13 }}
              onClick={() => setMenuOpen((v) => !v)}
            >
              {menuOpen ? "Close" : "Menu"}
            </button>
          </span>
        </div>

        {gameweek && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
            <span
              style={{
                background: "var(--color-text)",
                color: "var(--color-bg)",
                fontFamily: "var(--font-heading)",
                fontWeight: 800,
                fontSize: 11,
                letterSpacing: ".1em",
                padding: "3px 8px",
              }}
            >
              GW {gameweek.id}
            </span>
            <span style={{ fontSize: 13, color: "color-mix(in srgb, var(--color-text) 60%, transparent)" }}>
              {gameweek.state === "open" ? (
                <>
                  locks in{" "}
                  <span
                    style={{
                      fontFamily: "var(--font-heading)",
                      fontWeight: 800,
                      fontSize: 18,
                      color: "var(--color-accent)",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    <Countdown lockAt={gameweek.lock_at!} />
                  </span>
                </>
              ) : gameweek.state === "locked" ? (
                "locked — live now"
              ) : (
                "not scheduled yet"
              )}
            </span>
          </div>
        )}
      </div>

      {menuOpen && (
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px 12px" }}>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 0,
              border: "1px solid var(--color-divider)",
              background: "var(--color-surface)",
            }}
          >
            {MENU.map((m) => {
              const active = pathname === m.href;
              return (
                <button
                  key={m.href}
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    router.push(m.href);
                  }}
                  style={{
                    padding: "11px 18px",
                    background: active ? "var(--color-accent)" : "none",
                    color: active ? "var(--color-bg)" : "var(--color-text)",
                    border: 0,
                    borderRight: "1px solid var(--color-divider)",
                    fontFamily: "var(--font-heading)",
                    fontWeight: 800,
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div
        style={{
          borderTop: "2px solid var(--color-divider)",
          borderBottom: "2px solid var(--color-divider)",
          background: "var(--color-bg)",
        }}
      >
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", display: "flex", overflowX: "auto" }}>
          {sorted.map((row, i) => {
            const isMe = row.entrant_id === entrantId;
            return (
              <button
                key={row.entrant_id}
                type="button"
                onClick={() => router.push("/leaderboard")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 18px 8px 0",
                  marginRight: 18,
                  background: "none",
                  border: 0,
                  borderRight: "1px solid var(--color-divider)",
                  cursor: "pointer",
                  textAlign: "left",
                  fontFamily: "var(--font-body)",
                  color: "var(--color-text)",
                  boxShadow: isMe ? "inset 0 -3px 0 var(--color-accent)" : undefined,
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-heading)",
                    fontWeight: 800,
                    fontSize: 10,
                    letterSpacing: ".08em",
                    color: "color-mix(in srgb, var(--color-text) 45%, transparent)",
                  }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <Avatar entrantId={row.entrant_id} name={row.display_name} size={24} />
                <span style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}>
                    {row.display_name.split(" ")[0]}
                  </span>
                  <span style={{ fontSize: 10, letterSpacing: ".04em" }}>{"★".repeat(row.stars)}</span>
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-heading)",
                    fontWeight: 800,
                    fontSize: 22,
                    lineHeight: 1,
                    fontVariantNumeric: "tabular-nums",
                    marginLeft: "auto",
                  }}
                >
                  {row.total_points}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <GoalToasts gameweekId={gameweek?.state === "locked" ? gameweek.id : null} />
    </header>
  );
}
