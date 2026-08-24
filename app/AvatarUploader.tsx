"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { avatarUrl } from "@/lib/avatar";

export function AvatarUploader({ entrantId, initials }: { entrantId: string; initials: string }) {
  // Cache-bust with a version counter so a re-upload actually shows the new
  // image instead of the browser's cached copy of the old one at the same URL.
  const [version, setVersion] = useState(0);
  const [broken, setBroken] = useState(false);
  const [status, setStatus] = useState<"idle" | "uploading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus("uploading");
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.storage.from("avatars").upload(entrantId, file, {
      upsert: true,
      contentType: file.type,
      cacheControl: "3600",
    });

    if (error) {
      setStatus("error");
      setError(error.message);
      return;
    }
    setStatus("idle");
    setBroken(false);
    setVersion((v) => v + 1);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
      <div
        style={{
          width: 72,
          height: 72,
          display: "grid",
          placeItems: "center",
          overflow: "hidden",
          background: "var(--color-neutral-200)",
          fontFamily: "var(--font-heading)",
          fontWeight: 800,
          fontSize: 24,
          color: "var(--color-neutral-700)",
        }}
      >
        {broken ? (
          initials
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- user-uploaded, served straight from Supabase Storage
          <img
            src={`${avatarUrl(entrantId)}?v=${version}`}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            onError={() => setBroken(true)}
          />
        )}
      </div>
      <label>
        <span className="btn btn-secondary wb-tap" style={{ cursor: "pointer" }}>
          {status === "uploading" ? "Uploading…" : broken ? "Add a photo" : "Change photo"}
        </span>
        <input
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={handleFile}
          disabled={status === "uploading"}
        />
      </label>
      {error && <p style={{ fontSize: 13, color: "var(--color-accent-700)" }}>{error}</p>}
    </div>
  );
}
