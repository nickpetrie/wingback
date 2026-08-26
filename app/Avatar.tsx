"use client";

import { useState } from "react";
import { avatarUrl, initialsFor } from "@/lib/avatar";

/** Circular profile picture, or initials when there's no photo. Which of the
 * two is known before rendering (see lib/avatar.ts), so there's no failed
 * request and no flash of the wrong one. */
export function Avatar({
  entrantId,
  name,
  updatedAt,
  size = 24,
}: {
  entrantId: string;
  name: string;
  updatedAt: string | null;
  size?: number;
}) {
  const [broken, setBroken] = useState(false);
  const url = avatarUrl(entrantId, updatedAt);

  const shared = {
    width: size,
    height: size,
    flex: "none" as const,
    borderRadius: "50%",
    display: "block" as const,
  };

  if (!url || broken) {
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
      src={url}
      alt=""
      style={{ ...shared, objectFit: "cover" }}
      onError={() => setBroken(true)}
    />
  );
}
