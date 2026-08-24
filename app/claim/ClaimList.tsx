"use client";

import { useState, useTransition } from "react";
import { claimProfile } from "./actions";

interface Profile {
  id: string;
  display_name: string;
  claimed: boolean;
  stars: number;
}

export function ClaimList({ profiles }: { profiles: Profile[] }) {
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function claim(id: string) {
    setError(null);
    setPendingId(id);
    startTransition(async () => {
      const result = await claimProfile(id);
      if (!result.ok) {
        setError(result.error ?? "Could not claim that profile.");
        setPendingId(null);
      }
      // On success the action redirects; nothing further to do here.
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {profiles.map((p) => (
        <button
          key={p.id}
          type="button"
          disabled={p.claimed || isPending}
          onClick={() => claim(p.id)}
          className="flex items-center justify-between rounded-2xl border border-foreground/10 bg-surface px-5 py-4 text-left shadow-sm backdrop-blur-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 enabled:hover:border-pitch-500 enabled:hover:bg-white/5"
        >
          <span className="flex items-center gap-2">
            <span className="font-semibold text-foreground">{p.display_name}</span>
            {p.stars > 0 && (
              <span aria-label={`${p.stars} title${p.stars > 1 ? "s" : ""}`}>
                {"⭐".repeat(p.stars)}
              </span>
            )}
          </span>
          <span className="text-sm text-foreground/40">
            {p.claimed ? "Claimed" : pendingId === p.id && isPending ? "Claiming…" : "This is me"}
          </span>
        </button>
      ))}
      {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}
    </div>
  );
}
