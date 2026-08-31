"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { AppNotification } from "@/lib/alerts";
import type { CurrentGameweek } from "@/lib/gameweek";
import { AlertBell } from "./AlertBell";
import { Avatar } from "./Avatar";
import { Countdown } from "./pick/Countdown";
import { GoalToasts } from "./GoalToasts";
import { LiveRefresh } from "./LiveRefresh";
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
  notifications,
}: {
  gameweek: CurrentGameweek | null;
  entrantId: string;
  standings: StandingRow[];
  notifications: AppNotification[];
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

          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "none" }}>
          <AlertBell initial={notifications} />

          <button
            type="button"
            className="btn btn-secondary wb-tap btn-icon"
            aria-label="Menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
          >
            <svg width="18" height="14" viewBox="0 0 18 14" aria-hidden="true" fill="none">
              <path d="M0 1h18M0 7h18M0 13h18" stroke="currentColor" strokeWidth="2" />
            </svg>
          </button>
          </div>
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
            {/* Once the deadline passes, "locked" is the single most useful
                thing the header can say, so it gets the same badge treatment
                as the gameweek number rather than a line of grey prose. */}
            {gameweek.state === "locked" && (
              <span
                style={{
                  background: "var(--color-closed)",
                  color: "#fff",
                  fontFamily: "var(--font-heading)",
                  fontWeight: 800,
                  fontSize: 11,
                  letterSpacing: ".1em",
                  padding: "3px 8px",
                }}
              >
                LOCKED
              </span>
            )}
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
                // Not "live now": the lock lands an hour before the first
                // kickoff, so for that hour nothing is live yet.
                "picks are in"
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
        <div className="wb-page wb-standings" aria-label="Standings">
          {sorted.map((row, i) => {
            const isMe = row.entrant_id === entrantId;
            return (
              <button
                key={row.entrant_id}
                type="button"
                className={`wb-standing${isMe ? " wb-standing-me" : ""}`}
                aria-label={`${row.display_name}, ${i + 1}${i === 0 ? "st" : i === 1 ? "nd" : i === 2 ? "rd" : "th"}, ${row.total_points} point${row.total_points === 1 ? "" : "s"}`}
                onClick={() => router.push("/leaderboard")}
              >
                <span className="wb-standing-rank" aria-hidden="true">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <Avatar
                  entrantId={row.entrant_id}
                  name={row.display_name}
                  updatedAt={row.avatar_updated_at}
                  size={24}
                  online={online.has(row.entrant_id)}
                />
                <span className="wb-standing-who">
                  <span className="wb-standing-name">{row.display_name.split(" ")[0]}</span>
                  {row.stars > 0 && (
                    <span className="wb-standing-stars" aria-hidden="true">
                      {"\u2605".repeat(row.stars)}
                    </span>
                  )}
                </span>
                <span className="wb-standing-points" aria-hidden="true">
                  {row.total_points}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Mounted here rather than on Home so the table page stays live too,
          and so the standings strip above — which is layout, not page, and so
          is not re-rendered by a navigation on its own — keeps up. Unlike the
          toasts it is not gated on the lock: a pick appearing is news before
          the deadline, not after it. */}
      <LiveRefresh gameweekId={gameweek?.id ?? null} />
      <GoalToasts gameweekId={gameweek?.state === "locked" ? gameweek.id : null} />
    </header>
  );
}
