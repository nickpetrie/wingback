"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { avatarPreviewUrl, avatarUrl } from "@/lib/avatar";
import { markAvatarUploaded } from "./actions";
import { AvatarCropper } from "./AvatarCropper";

export function AvatarUploader({
  entrantId,
  initials,
  updatedAt,
}: {
  entrantId: string;
  initials: string;
  updatedAt: string | null;
}) {
  // Cache-bust with a version counter so a re-upload actually shows the new
  // image instead of the browser's cached copy of the old one at the same URL.
  const [version, setVersion] = useState(0);
  const [broken, setBroken] = useState(false);
  // Before any upload in this session, whether there's a photo is known from
  // the server rather than discovered by a failing request.
  const src = version === 0 ? avatarUrl(entrantId, updatedAt) : avatarPreviewUrl(entrantId, version);
  const [pending, setPending] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  function chooseFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset the input so picking the same file twice still opens the cropper.
    e.target.value = "";
    if (file) {
      setError(null);
      setPending(file);
    }
  }

  async function upload(blob: Blob) {
    setPending(null);
    setStatus("uploading");
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.storage.from("avatars").upload(entrantId, blob, {
      upsert: true,
      contentType: "image/jpeg",
      cacheControl: "60",
    });

    if (error) {
      setStatus("error");
      setError(error.message);
      return;
    }
    const marked = await markAvatarUploaded();
    if (!marked.ok) {
      setStatus("error");
      setError(marked.error ?? "Uploaded, but couldn't record it.");
      return;
    }

    setStatus("idle");
    setBroken(false);
    setVersion((v) => v + 1);
    // The standings strip renders on the server — refresh so the new photo
    // shows up there too, not just in this preview.
    router.refresh();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: "50%",
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
        {!src || broken ? (
          initials
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- user-uploaded, served straight from Supabase Storage
          <img
            src={src}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            onError={() => setBroken(true)}
          />
        )}
      </div>

      <button
        type="button"
        className="btn btn-secondary wb-tap"
        onClick={() => inputRef.current?.click()}
        disabled={status === "uploading"}
      >
        {status === "uploading" ? "Uploading…" : !src || broken ? "Add a photo" : "Change photo"}
      </button>
      <input ref={inputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={chooseFile} />

      {error && <p style={{ margin: 0, fontSize: 13, color: "var(--color-accent-700)" }}>{error}</p>}

      {pending && (
        <AvatarCropper file={pending} onCancel={() => setPending(null)} onDone={upload} />
      )}
    </div>
  );
}
