"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/** Entrant ids currently on the site, via a Supabase Realtime presence channel.
 *
 * Presence is ephemeral by design — it lives in the channel, not in a table —
 * which is exactly right here: "who has the app open" is not a fact worth
 * persisting, and nothing needs to reconcile it after a crashed tab. */
export function usePresence(entrantId: string): Set<string> {
  const [online, setOnline] = useState<Set<string>>(() => new Set([entrantId]));

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel("wingback-presence", {
      config: { presence: { key: entrantId } },
    });

    const sync = () => {
      const state = channel.presenceState();
      // You are always in your own set: the channel can take a moment to echo
      // your own join back, and blinking your dot off is just noise.
      setOnline(new Set([entrantId, ...Object.keys(state)]));
    };

    channel
      .on("presence", { event: "sync" }, sync)
      .on("presence", { event: "join" }, sync)
      .on("presence", { event: "leave" }, sync)
      .subscribe((status) => {
        if (status === "SUBSCRIBED") channel.track({ at: Date.now() });
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [entrantId]);

  return online;
}
