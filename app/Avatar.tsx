"use client";

import { useState } from "react";
import { avatarUrl, initialsFor } from "@/lib/avatar";

/** Circular profile picture, falling back to initials. The bucket has no
 * "does this object exist" column — the URL is always derivable — so a missing
 * photo is discovered by the <img> failing to load, not asked about up front. */
export function Avatar({
  entrantId,
  name,
  size = 24,
  version,
}: {
  entrantId: string;
  name: string;
  size?: number;
  version?: number;
}) {
  const [broken, setBroken] = useState(false);

  const shared = {
    width: size,
    height: size,
    flex: "none" as const,
    borderRadius: "50%",
    display: "block" as const,
  };

  if (broken) {
    return (
      <span
        aria-hidden="true"
        style={{
          ...shared,
          display: "grid",
          placeItems: "center",
          background: "var(--color-neutral-300)",
          color: "var(--color-neutral-700)",
          fontFamily: "var(--font-heading)",
          fontWeight: 800,
          fontSize: Math.max(8, Math.round(size * 0.4)),
          lineHeight: 1,
        }}
      >
        {initialsFor(name)}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- user-uploaded, served straight from Supabase Storage
    <img
      src={version === undefined ? avatarUrl(entrantId) : `${avatarUrl(entrantId)}?v=${version}`}
      alt=""
      style={{ ...shared, objectFit: "cover" }}
      onError={() => setBroken(true)}
    />
  );
}
