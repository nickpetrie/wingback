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
    <div className="flex flex-col items-center gap-3">
      <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-pitch-100 text-2xl font-bold text-pitch-700">
        {broken ? (
          initials
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- user-uploaded, served straight from Supabase Storage
          <img
            src={`${avatarUrl(entrantId)}?v=${version}`}
            alt=""
            className="h-full w-full object-cover"
            onError={() => setBroken(true)}
          />
        )}
      </div>
      <label className="cursor-pointer rounded-full bg-gold-500/15 px-4 py-2 text-sm font-medium text-gold-400 hover:bg-gold-500/25">
        {status === "uploading" ? "Uploading…" : broken ? "Add a photo" : "Change photo"}
        <input type="file" accept="image/*" className="hidden" onChange={handleFile} disabled={status === "uploading"} />
      </label>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
