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
    <div>
      {profiles.map((p) => (
        <button
          key={p.id}
          type="button"
          disabled={p.claimed || isPending}
          onClick={() => claim(p.id)}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            width: "100%",
            padding: "16px 0",
            background: "none",
            border: 0,
            borderBottom: "1px solid var(--color-divider)",
            textAlign: "left",
            fontFamily: "var(--font-body)",
            color: "var(--color-text)",
            cursor: p.claimed || isPending ? "not-allowed" : "pointer",
            opacity: p.claimed ? 0.45 : 1,
          }}
        >
          <span style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 20 }}>{p.display_name}</span>
            {p.stars > 0 && <span style={{ fontSize: 12 }}>{"★".repeat(p.stars)}</span>}
          </span>
          <span style={{ fontSize: 12, color: "color-mix(in srgb, var(--color-text) 55%, transparent)" }}>
            {p.claimed ? "Claimed" : pendingId === p.id && isPending ? "Claiming…" : "This is me"}
          </span>
        </button>
      ))}
      {error && (
        <p style={{ marginTop: 12, background: "var(--color-accent-100)", color: "var(--color-accent-800)", fontSize: 13, padding: "8px 10px", borderLeft: "3px solid var(--color-accent)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
