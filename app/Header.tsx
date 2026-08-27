"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { CurrentGameweek } from "@/lib/gameweek";
import { Avatar } from "./Avatar";
import { Countdown } from "./pick/Countdown";
import { GoalToasts } from "./GoalToasts";
import { usePresence } from "./usePresence";
import { signOut } from "./actions";

export interface StandingRow {
  entrant_id: string;
  display_name: string;
  total_points: number;
  stars: number;
  avatar_updated_at: string | null;
}

// No "Pick" entry: picking is inline on the home page, so a route that renders
// the same form again is just a second door into one room.
const MENU = [
  { href: "/", label: "Home" },
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

  const online = usePresence(entrantId);
  const sorted = [...standings].sort((a, b) => b.total_points - a.total_points);

  return (
    <header style={{ position: "sticky", top: 0, zIndex: 30, background: "var(--color-bg)" }}>
      <div className="wb-page" style={{ padding: "14px 24px 12px" }}>
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

          <button
            type="button"
            className="btn btn-secondary wb-tap"
            aria-label="Menu"
            aria-expanded={menuOpen}
            style={{ flex: "none", padding: "8px 10px" }}
            onClick={() => setMenuOpen(true)}
          >
            <svg width="18" height="14" viewBox="0 0 18 14" aria-hidden="true" fill="none">
              <path d="M0 1h18M0 7h18M0 13h18" stroke="currentColor" strokeWidth="2" />
            </svg>
          </button>
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
        <>
          <div className="wb-scrim" onClick={() => setMenuOpen(false)} aria-hidden="true" />
          <nav className="wb-drawer" aria-label="Main menu">
            <div className="wb-drawer-head">
              <span style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 12, letterSpacing: ".1em", textTransform: "uppercase", color: "color-mix(in srgb, var(--color-text) 55%, transparent)" }}>
                Menu
              </span>
              <button
                type="button"
                className="btn btn-ghost wb-tap"
                aria-label="Close menu"
                style={{ padding: "4px 8px" }}
                onClick={() => setMenuOpen(false)}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" fill="none">
                  <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" />
                </svg>
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column" }}>
              {MENU.map((m) => {
                const active = pathname === m.href;
                return (
                  <button
                    key={m.href}
                    type="button"
                    className="wb-drawer-item"
                    aria-current={active ? "page" : undefined}
                    onClick={() => {
                      setMenuOpen(false);
                      router.push(m.href);
                    }}
                    style={{
                      background: active ? "var(--color-accent)" : "none",
                      color: active ? "var(--color-bg)" : "var(--color-text)",
                    }}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>

            {/* Sign out lives at the bottom, away from the things you actually
                came here to tap. */}
            <button
              type="button"
              className="wb-drawer-item wb-drawer-signout"
              onClick={() => signOut()}
            >
              Sign out
            </button>
          </nav>
        </>
      )}

      <div
        style={{
          borderTop: "2px solid var(--color-divider)",
          borderBottom: "2px solid var(--color-divider)",
          background: "var(--color-bg)",
        }}
      >
        <div className="wb-page wb-standings">
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
                <Avatar
                  entrantId={row.entrant_id}
                  name={row.display_name}
                  updatedAt={row.avatar_updated_at}
                  size={24}
                  online={online.has(row.entrant_id)}
                />
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
                    // Not marginLeft:auto — once the cells stretch to fill the
                    // column, that strands the score half a screen from the
                    // name it belongs to.
                    marginLeft: 4,
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
