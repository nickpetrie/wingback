"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { AppNotification } from "@/lib/alerts";
import type { CurrentGameweek } from "@/lib/gameweek";
import { AlertBell } from "./AlertBell";
import { Avatar } from "./Avatar";
import { Countdown } from "./pick/Countdown";
import { GoalToasts } from "./GoalToasts";
import { LiveRefresh } from "./LiveRefresh";
import { useDialog } from "./useDialog";
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
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const menuButton = useRef<HTMLButtonElement>(null);
  const menuClose = useRef<HTMLButtonElement>(null);
  useDialog(menuOpen, closeMenu, menuButton, menuClose);

  const pathname = usePathname();
  const router = useRouter();

  const online = usePresence(entrantId);
  const sorted = [...standings].sort((a, b) => b.total_points - a.total_points);

  return (
    <header className="wb-header">
      <div className="wb-page wb-header-bar">
        <div className="wb-header-row">
          <Link href="/" className="wb-wordmark">
            WINGBACK
          </Link>

          <div className="wb-header-actions">
            <AlertBell initial={notifications} />

            <button
              ref={menuButton}
              type="button"
              className="btn btn-secondary wb-tap btn-icon"
              aria-label="Menu"
              aria-expanded={menuOpen}
              aria-controls={menuOpen ? "wb-menu" : undefined}
              onClick={() => setMenuOpen(true)}
            >
              <svg width="18" height="14" viewBox="0 0 18 14" aria-hidden="true" fill="none">
                <path d="M0 1h18M0 7h18M0 13h18" stroke="currentColor" strokeWidth="2" />
              </svg>
            </button>
          </div>
        </div>

        {gameweek && (
          <div className="wb-header-gw">
            <span className="wb-header-badge">GW {gameweek.id}</span>
            {/* Once the deadline passes, "locked" is the single most useful
                thing the header can say, so it gets the same badge treatment
                as the gameweek number rather than a line of grey prose. */}
            {gameweek.state === "locked" && (
              <span className="wb-header-badge wb-header-badge-locked">LOCKED</span>
            )}
            <span className="wb-header-status">
              {gameweek.state === "open" ? (
                <>
                  locks in{" "}
                  <span className="wb-header-countdown">
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
          <div className="wb-scrim" onClick={closeMenu} aria-hidden="true" />
          <div id="wb-menu" className="wb-drawer" role="dialog" aria-modal="true" aria-label="Menu">
            <div className="wb-drawer-head">
              <span className="wb-drawer-title">Menu</span>
              <button
                ref={menuClose}
                type="button"
                className="btn btn-ghost wb-tap btn-icon"
                aria-label="Close menu"
                onClick={closeMenu}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" fill="none">
                  <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" />
                </svg>
              </button>
            </div>

            {/* Links, not buttons that push a route: VoiceOver then says
                "link", and a long press offers to open in a new tab. */}
            <nav aria-label="Main menu" style={{ display: "flex", flexDirection: "column" }}>
              {MENU.map((m) => (
                <Link
                  key={m.href}
                  href={m.href}
                  className="wb-drawer-item"
                  aria-current={pathname === m.href ? "page" : undefined}
                  onClick={closeMenu}
                >
                  {m.label}
                </Link>
              ))}
            </nav>

            {/* Sign out lives at the bottom, away from the things you actually
                came here to tap. */}
            <button
              type="button"
              className="wb-drawer-item wb-drawer-signout"
              onClick={() => signOut()}
            >
              Sign out
            </button>
          </div>
        </>
      )}

      <div className="wb-header-standings">
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
                      {"★".repeat(row.stars)}
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
