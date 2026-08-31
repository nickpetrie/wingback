"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { AppNotification } from "@/lib/alerts";
import { createClient } from "@/lib/supabase/client";
import { relativeTime } from "@/lib/relativeTime";
import { markAlertsRead } from "./settings/actions";

const KIND_GLYPH: Record<string, string> = {
  goal: "⚽",
  pick_made: "✓",
  pick_reminder: "⏰",
  injury: "⚠",
  results: "★",
};

/** The bell, and the panel of everything that's happened.
 *
 * The feed is the one channel that can't fail: email needs a provider key,
 * SMS needs a number, push needs an installed PWA and a granted permission.
 * Whatever else is switched off, an alert always lands here. */
export function AlertBell({ initial: items }: { initial: AppNotification[] }) {
  const [open, setOpen] = useState(false);
  // Ids dismissed on this device since the last server render. The list
  // itself is never copied into state: it arrives as a prop on every render
  // of the page, and a local copy could only ever be a staler version of it.
  const [readHere, setReadHere] = useState<ReadonlySet<number>>(new Set());
  const router = useRouter();

  // New rows arrive live, so a goal reaches the bell while you're looking at
  // the page rather than on your next navigation.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("my-notifications")
      .on(
        "postgres_changes",
        // RLS filters this to the signed-in entrant's own rows, so there is
        // no entrant filter to get wrong here.
        { event: "INSERT", schema: "public", table: "notifications" },
        () => router.refresh(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [router]);

  const unread = items.filter((n) => !n.read_at && !readHere.has(n.id)).length;

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      // Optimistic: the badge clears on the tap that opened the panel, not a
      // round trip later. Tracking ids rather than a single "all read" flag
      // means an alert that lands while the panel is open still counts.
      setReadHere(new Set(items.map((n) => n.id)));
      void markAlertsRead();
    }
  }

  return (
    <>
      <button
        type="button"
        className="btn btn-secondary wb-tap btn-icon wb-bell"
        aria-label={unread > 0 ? `Alerts, ${unread} unread` : "Alerts"}
        aria-expanded={open}
        onClick={toggle}
      >
        <svg width="16" height="17" viewBox="0 0 16 17" aria-hidden="true" fill="none">
          <path
            d="M8 1a4.5 4.5 0 0 0-4.5 4.5c0 3-1.5 4-1.5 5h12c0-1-1.5-2-1.5-5A4.5 4.5 0 0 0 8 1Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path d="M6.2 13a1.9 1.9 0 0 0 3.6 0" stroke="currentColor" strokeWidth="1.6" />
        </svg>
        {unread > 0 && (
          <span className="wb-bell-count" aria-hidden="true">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="wb-scrim" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="wb-alerts-panel" role="dialog" aria-label="Alerts">
            <div className="wb-drawer-head">
              <span className="wb-alerts-panel-title">Alerts</span>
              <button
                type="button"
                className="btn btn-ghost wb-tap"
                aria-label="Close alerts"
                style={{ padding: "4px 8px" }}
                onClick={() => setOpen(false)}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" fill="none">
                  <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" />
                </svg>
              </button>
            </div>

            <div className="wb-alerts-scroll">
              {items.length === 0 ? (
                <p className="wb-alerts-empty">
                  Nothing yet. Goals, picks and deadline nudges will land here — choose which in
                  Settings under Alerts.
                </p>
              ) : (
                items.map((n) => (
                  <article key={n.id} className="wb-alert-item">
                    <span className="wb-alert-glyph" aria-hidden="true">
                      {KIND_GLYPH[n.kind] ?? "•"}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <p className="wb-alert-item-title">{n.title}</p>
                      <p className="wb-alert-item-body">{n.body}</p>
                      <p className="wb-alert-item-when">{relativeTime(n.created_at)}</p>
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
