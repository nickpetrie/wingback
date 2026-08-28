"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/** Re-renders the current page whenever anyone's pick lands.
 *
 * Picks are public the moment they're made, but that only meant "public to
 * whoever reloads next" — everyone else sat looking at "No pick made" until
 * they thought to pull down. This closes that gap by asking the server for
 * the page again, rather than patching a copy of the pick into client state:
 * every surface that shows a pick (the other four, the fixture chips, the
 * count in the header line) then updates from one source, and none of them
 * has to learn how to merge a realtime row.
 */
export function LivePicks({ gameweekId }: { gameweekId: number | null }) {
  const router = useRouter();

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

  return null;
}
