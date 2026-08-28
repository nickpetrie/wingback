"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/** Keeps what's on screen in step with the database, on two triggers.
 *
 * Both end in `router.refresh()` rather than patching rows into client state:
 * every surface that shows a pick or a score — the standings strip, the other
 * four, the fixture chips, the count in the header line — then updates from
 * one source, and none of them has to learn how to merge a row.
 */
export function LiveRefresh({ gameweekId }: { gameweekId: number | null }) {
  const router = useRouter();
  const pathname = usePathname();

  // 1. Someone picks, or the score function records a goal.
  //
  // Picks are public the moment they're made, but that only meant "public to
  // whoever reloads next" — everyone else sat looking at "No pick made" until
  // they thought to pull down.
  useEffect(() => {
    if (!gameweekId) return;
    const supabase = createClient();

    // Five friends all picking in the last minute before a deadline is a
    // realistic burst, and each one would otherwise be its own full refetch.
    let pending: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => {
      if (pending) clearTimeout(pending);
      pending = setTimeout(() => router.refresh(), 400);
    };

    const channel = supabase
      .channel(`gw-${gameweekId}-picks`)
      .on(
        "postgres_changes",
        // Not just INSERT: changing your mind before the lock is an UPDATE,
        // and it should reach the other four's screens the same way.
        { event: "*", schema: "public", table: "picks", filter: `gameweek=eq.${gameweekId}` },
        refresh,
      )
      .subscribe();

    return () => {
      if (pending) clearTimeout(pending);
      void supabase.removeChannel(channel);
    };
  }, [gameweekId, router]);

  // 2. Moving between pages.
  //
  // The standings strip lives in the root layout, and the App Router renders
  // layouts once and reuses them across navigations between pages that share
  // them — only the page segment is re-fetched. So the strip kept showing
  // whatever the scores were when the app was last loaded from cold, while
  // the table underneath it, being a page, showed the real ones: Henry on 1
  // in the strip and 2 in the table, from the same view, at the same moment.
  // Refreshing on a route change re-renders the layout too.
  useEffect(() => {
    router.refresh();
  }, [pathname, router]);

  return null;
}
