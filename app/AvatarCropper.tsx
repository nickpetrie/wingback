"use client";

import { useEffect, useRef, useState } from "react";

const OUTPUT_PX = 512;

/** Square crop with a circular guide, so what you drag into the ring is exactly
 * what the little leaderboard circles will show. Also the reason uploads are a
 * sane size now: the source phone photo never leaves the browser — only the
 * 512px JPEG this produces does. */
export function AvatarCropper({
  file,
  onCancel,
  onDone,
}: {
  file: File;
  onCancel: () => void;
  onDone: (blob: Blob) => void;
}) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [failed, setFailed] = useState(false);
  const [zoom, setZoom] = useState(1);
  // null until dragged: the resting position is "centred", which can't be
  // computed before the image and the frame have both been measured.
  const [rawOffset, setRawOffset] = useState<{ x: number; y: number } | null>(null);
  const [viewport, setViewport] = useState(280);

  const drag = useRef<{ id: number; startX: number; startY: number; ox: number; oy: number } | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => setImg(image);
    image.onerror = () => setFailed(true);
    image.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    function measure() {
      setViewport(Math.max(200, Math.min(320, window.innerWidth - 96)));
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // Scale that makes the image just cover the crop square, whichever way it's
  // shaped; zoom multiplies it, so zoom=1 is always "as far out as allowed".
  const baseScale = img ? viewport / Math.min(img.naturalWidth, img.naturalHeight) : 1;
  const scale = baseScale * zoom;
  const drawnW = img ? img.naturalWidth * scale : 0;
  const drawnH = img ? img.naturalHeight * scale : 0;

  function clamp(next: { x: number; y: number }) {
    return {
      x: Math.min(0, Math.max(viewport - drawnW, next.x)),
      y: Math.min(0, Math.max(viewport - drawnH, next.y)),
    };
  }

  // Clamped on the way out rather than stored clamped, so zooming can never
  // leave a gap at the edge of the frame and zooming back in restores where you
  // had dragged to.
  const offset = clamp(rawOffset ?? { x: (viewport - drawnW) / 2, y: (viewport - drawnH) / 2 });

  function onPointerDown(e: React.PointerEvent) {
    drag.current = { id: e.pointerId, startX: e.clientX, startY: e.clientY, ox: offset.x, oy: offset.y };
    (e.target as Element).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    setRawOffset(clamp({ x: d.ox + (e.clientX - d.startX), y: d.oy + (e.clientY - d.startY) }));
  }

  function onPointerUp(e: React.PointerEvent) {
    if (drag.current?.id === e.pointerId) drag.current = null;
  }

  function confirm() {
    if (!img) return;
    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT_PX;
    canvas.height = OUTPUT_PX;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // The preview is the crop: same geometry, scaled up from viewport px to the
    // output square.
    const k = OUTPUT_PX / viewport;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, OUTPUT_PX, OUTPUT_PX);
    ctx.drawImage(img, offset.x * k, offset.y * k, drawnW * k, drawnH * k);

    canvas.toBlob((blob) => blob && onDone(blob), "image/jpeg", 0.85);
  }

  return (
    <div className="dialog-backdrop" style={{ zIndex: 60 }} role="dialog" aria-modal="true" aria-label="Crop your photo">
      <div className="dialog" style={{ width: "min(420px, 100%)", background: "var(--color-bg)" }}>
        <p style={{ margin: 0, fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 20 }}>
          Frame your face
        </p>

        {failed ? (
          <p style={{ margin: 0, fontSize: 13, color: "var(--color-accent-700)" }}>
            That file didn&rsquo;t open as an image. Try a JPEG or PNG.
          </p>
        ) : (
          <>
            <div
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              style={{
                position: "relative",
                width: viewport,
                height: viewport,
                margin: "0 auto",
                overflow: "hidden",
                background: "var(--color-neutral-200)",
                cursor: "grab",
                touchAction: "none",
              }}
            >
              {img && (
                // eslint-disable-next-line @next/next/no-img-element -- local object URL being cropped
                <img
                  src={img.src}
                  alt=""
                  draggable={false}
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    width: drawnW,
                    height: drawnH,
                    transform: `translate(${offset.x}px, ${offset.y}px)`,
                    maxWidth: "none",
                    userSelect: "none",
                  }}
                />
              )}
              {/* Circular guide: everything outside the ring is dimmed, so you can
                  see the crop you'll actually get in the standings strip. */}
              <div
                aria-hidden="true"
                style={{
                  position: "absolute",
                  inset: 0,
                  pointerEvents: "none",
                  background: "rgba(0,0,0,.45)",
                  WebkitMaskImage: "radial-gradient(circle at 50% 50%, transparent 49.5%, #000 50%)",
                  maskImage: "radial-gradient(circle at 50% 50%, transparent 49.5%, #000 50%)",
                }}
              />
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12 }}>
              <span style={{ letterSpacing: ".08em", textTransform: "uppercase", color: "color-mix(in srgb, var(--color-text) 55%, transparent)" }}>
                Zoom
              </span>
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                style={{ flex: 1, accentColor: "var(--color-accent)" }}
              />
            </label>
          </>
        )}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button type="button" className="btn btn-secondary wb-tap" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary wb-tap" onClick={confirm} disabled={!img || failed}>
            Use this
          </button>
        </div>
      </div>
    </div>
  );
}
