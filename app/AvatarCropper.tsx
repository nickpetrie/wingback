"use client";

import { useEffect, useRef, useState } from "react";
import { detectFocalPoint, type FocalPoint } from "@/lib/focalPoint";

const OUTPUT_PX = 512;
const MAX_ZOOM = 4;

type Point = { x: number; y: number };

type Gesture =
  | { kind: "pan"; id: number; from: Point; offset: Point }
  | { kind: "pinch"; startDist: number; startZoom: number; startMid: Point; offset: Point }
  | null;

function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}
function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

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
  const [focal, setFocal] = useState<FocalPoint | null>(null);
  const [detecting, setDetecting] = useState(true);
  // Both null until touched, so a detected face can suggest them and the
  // suggestion survives a resize.
  const [rawZoom, setRawZoom] = useState<number | null>(null);
  const [rawOffset, setRawOffset] = useState<Point | null>(null);
  const [viewport, setViewport] = useState(300);

  const frameRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef<Gesture>(null);

  useEffect(() => {
    let live = true;
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      if (!live) return;
      detectFocalPoint(image)
        .catch(() => null)
        .then((point) => {
          if (!live) return;
          setFocal(point);
          setImg(image);
          setDetecting(false);
        });
    };
    image.onerror = () => {
      if (!live) return;
      setFailed(true);
      setDetecting(false);
    };
    image.src = url;
    return () => {
      live = false;
      URL.revokeObjectURL(url);
    };
  }, [file]);

  useEffect(() => {
    function measure() {
      setViewport(Math.max(240, Math.min(360, window.innerWidth - 64)));
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // A detected face fills a bit over a third of the frame at zoom 1 if it's
  // small in the original — zoom in so it fills ~55% of the ring instead.
  const suggestedZoom = focal?.size ? Math.min(MAX_ZOOM, Math.max(1, 0.55 / focal.size)) : 1;
  const zoom = rawZoom ?? suggestedZoom;

  // Scale that makes the image just cover the crop square, whichever way it's
  // shaped; zoom multiplies it, so zoom=1 is always "as far out as allowed".
  const baseScale = img ? viewport / Math.min(img.naturalWidth, img.naturalHeight) : 1;
  const sizeAt = (z: number) => ({
    w: img ? img.naturalWidth * baseScale * z : 0,
    h: img ? img.naturalHeight * baseScale * z : 0,
  });
  const { w: drawnW, h: drawnH } = sizeAt(zoom);

  function clampAt(z: number, next: Point): Point {
    const { w, h } = sizeAt(z);
    return {
      x: Math.min(0, Math.max(viewport - w, next.x)),
      y: Math.min(0, Math.max(viewport - h, next.y)),
    };
  }

  // Put the focal point in the middle of the ring, falling back to the middle
  // of the image. Derived rather than stored, so it survives a zoom — the face
  // stays centred as you scale instead of drifting off.
  const suggested = focal
    ? { x: viewport / 2 - focal.x * drawnW, y: viewport / 2 - focal.y * drawnH }
    : { x: (viewport - drawnW) / 2, y: (viewport - drawnH) / 2 };

  const offset = clampAt(zoom, rawOffset ?? suggested);

  /** Zoom about a fixed point, so whatever is under your fingers (or under the
   * middle of the ring) stays there. Without this the image scales from its
   * top-left corner and the face you just lined up slides out of the frame —
   * which is what made this fiddly. */
  function zoomAbout(nextZoom: number, anchor: Point, from = { zoom, offset }) {
    const z = Math.min(MAX_ZOOM, Math.max(1, nextZoom));
    const k = z / from.zoom;
    setRawZoom(z);
    setRawOffset(
      clampAt(z, {
        x: anchor.x - (anchor.x - from.offset.x) * k,
        y: anchor.y - (anchor.y - from.offset.y) * k,
      }),
    );
  }

  function localPoint(e: { clientX: number; clientY: number }): Point {
    const rect = frameRef.current?.getBoundingClientRect();
    return { x: e.clientX - (rect?.left ?? 0), y: e.clientY - (rect?.top ?? 0) };
  }

  function onPointerDown(e: React.PointerEvent) {
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, localPoint(e));
    const active = [...pointers.current.values()];

    if (active.length === 1) {
      gesture.current = { kind: "pan", id: e.pointerId, from: active[0], offset };
    } else if (active.length === 2) {
      gesture.current = {
        kind: "pinch",
        startDist: distance(active[0], active[1]),
        startZoom: zoom,
        startMid: midpoint(active[0], active[1]),
        offset,
      };
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, localPoint(e));
    const g = gesture.current;
    if (!g) return;

    if (g.kind === "pan" && g.id === e.pointerId) {
      const now = pointers.current.get(e.pointerId)!;
      setRawOffset(
        clampAt(zoom, {
          x: g.offset.x + (now.x - g.from.x),
          y: g.offset.y + (now.y - g.from.y),
        }),
      );
      return;
    }

    if (g.kind === "pinch") {
      const active = [...pointers.current.values()];
      if (active.length < 2) return;
      const dist = distance(active[0], active[1]);
      if (g.startDist === 0) return;
      // The pinch pans as well as zooms: anchor on where the fingers are now,
      // measured from where they started.
      const mid = midpoint(active[0], active[1]);
      const z = Math.min(MAX_ZOOM, Math.max(1, g.startZoom * (dist / g.startDist)));
      const k = z / g.startZoom;
      setRawZoom(z);
      setRawOffset(
        clampAt(z, {
          x: mid.x - (g.startMid.x - g.offset.x) * k,
          y: mid.y - (g.startMid.y - g.offset.y) * k,
        }),
      );
    }
  }

  function endPointer(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId);
    const active = [...pointers.current.entries()];
    // Dropping from two fingers to one shouldn't jump: restart a pan from
    // wherever the remaining finger is.
    gesture.current =
      active.length === 1
        ? { kind: "pan", id: active[0][0], from: active[0][1], offset }
        : null;
  }

  function onWheel(e: React.WheelEvent) {
    if (!img) return;
    zoomAbout(zoom * (1 - e.deltaY * 0.0015), localPoint(e));
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
      <div className="dialog" style={{ width: "min(440px, 100%)", background: "var(--color-bg)" }}>
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
              ref={frameRef}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={endPointer}
              onPointerCancel={endPointer}
              onWheel={onWheel}
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

            <p style={{ margin: 0, fontSize: 12, textAlign: "center", color: "color-mix(in srgb, var(--color-text) 55%, transparent)" }}>
              {detecting
                ? "Looking for a face…"
                : focal
                  ? "Centred on the face — drag or pinch to adjust."
                  : "Drag to position, pinch to zoom."}
            </p>

            <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12 }}>
              <button
                type="button"
                className="btn btn-secondary wb-tap"
                aria-label="Zoom out"
                style={{ padding: "2px 12px", fontSize: 16, lineHeight: 1.2 }}
                onClick={() => zoomAbout(zoom - 0.25, { x: viewport / 2, y: viewport / 2 })}
              >
                −
              </button>
              <input
                type="range"
                aria-label="Zoom"
                min={1}
                max={MAX_ZOOM}
                step={0.01}
                value={zoom}
                onChange={(e) => zoomAbout(Number(e.target.value), { x: viewport / 2, y: viewport / 2 })}
                style={{ flex: 1, accentColor: "var(--color-accent)" }}
              />
              <button
                type="button"
                className="btn btn-secondary wb-tap"
                aria-label="Zoom in"
                style={{ padding: "2px 12px", fontSize: 16, lineHeight: 1.2 }}
                onClick={() => zoomAbout(zoom + 0.25, { x: viewport / 2, y: viewport / 2 })}
              >
                +
              </button>
            </div>
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
