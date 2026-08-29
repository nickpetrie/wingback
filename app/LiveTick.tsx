"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Re-renders the page at the next moment its answer could change.
 *
 * Liveness is worked out on the server, from `started` and `played`, so this
 * has nothing to decide — it only has to make sure someone sitting on the
 * page at 14:59 sees the 15:00 kickoff. `LiveRefresh` already covers goals
 * (they land as picks UPDATEs on the realtime channel), but a match starting
 * changes no row this app subscribes to.
 *
 * A moment rather than an interval, because most of the week has nothing to
 * watch: the server says "wake me at the next kickoff", and between Sunday
 * night and Saturday lunchtime that is one sleeping timer, not a poller. */
export function LiveTick({ at }: { at: number | null }) {
  const router = useRouter();

  useEffect(() => {
    if (at === null) return;

    // setTimeout takes a 32-bit delay: anything over ~24.8 days fires
    // immediately, which would turn a quiet international break into a
    // refresh loop. Capping also bounds how stale a tab left open all day
    // can get.
    const delay = Math.min(Math.max(at - Date.now(), 1000), 6 * 60 * 60 * 1000);
    const timer = setTimeout(() => router.refresh(), delay);
    return () => clearTimeout(timer);
  }, [at, router]);

  return null;
}
