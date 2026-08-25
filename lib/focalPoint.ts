/** Where the crop should start, as fractions of the image (0–1), plus how big
 * the interesting thing is when we actually know (a face box gives us that; the
 * fallback heuristic doesn't). */
export interface FocalPoint {
  x: number;
  y: number;
  /** Fraction of the image's short side the subject occupies, when known. */
  size?: number;
}

interface FaceBox {
  boundingBox: { x: number; y: number; width: number; height: number };
}
interface FaceDetectorLike {
  detect(image: CanvasImageSource): Promise<FaceBox[]>;
}
type FaceDetectorCtor = new (opts?: { fastMode?: boolean; maxDetectedFaces?: number }) => FaceDetectorLike;

/** Chrome-on-Android ships the Shape Detection API; Safari and Chrome desktop
 * don't, so this is a bonus path, not the plan. */
async function detectWithPlatformApi(img: HTMLImageElement): Promise<FocalPoint | null> {
  const ctor = (globalThis as { FaceDetector?: FaceDetectorCtor }).FaceDetector;
  if (!ctor) return null;
  try {
    const faces = await new ctor({ fastMode: true, maxDetectedFaces: 5 }).detect(img);
    if (faces.length === 0) return null;
    // Biggest face wins — in a group photo the subject is the one in front.
    const biggest = faces.reduce((a, b) =>
      b.boundingBox.width * b.boundingBox.height > a.boundingBox.width * a.boundingBox.height ? b : a,
    );
    const { x, y, width, height } = biggest.boundingBox;
    const shortSide = Math.min(img.naturalWidth, img.naturalHeight);
    return {
      x: (x + width / 2) / img.naturalWidth,
      y: (y + height / 2) / img.naturalHeight,
      size: Math.max(width, height) / shortSide,
    };
  } catch {
    return null; // the API exists but is unavailable/blocked on this device
  }
}

const SAMPLE_PX = 96;
const MIN_SKIN_FRACTION = 0.015;

/** No model, no download: find the skin-toned pixels, then find the face
 * within them.
 *
 * The YCbCr rule below is the standard one because chrominance separates skin
 * from most backgrounds far more consistently across skin tones than an RGB
 * rule does — brightness varies enormously, hue much less.
 *
 * Taking the centroid of all skin pixels is the obvious next step and it is
 * wrong: in a head-and-shoulders shot — i.e. every photo anyone will actually
 * upload here — bare arms and chest outweigh the face and drag the point down
 * onto the sternum. So instead, take only the topmost blob of skin, because the
 * head is the top of a person, and stop at the shoulders.
 *
 * It is still only a guess — wood, sand and terracotta all read as skin. That's
 * tolerable, because the worst case is the centred crop we'd have used anyway,
 * and it's draggable regardless. */
function detectByTone(img: HTMLImageElement): FocalPoint | null {
  const scale = SAMPLE_PX / Math.max(img.naturalWidth, img.naturalHeight);
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, w, h);

  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, w, h).data;
  } catch {
    return null; // tainted canvas; never happens for a local file, but cheap to guard
  }

  const rowCount = new Float64Array(h);
  const rowSumX = new Float64Array(h);
  const rowMinX = new Float64Array(h).fill(w);
  const rowMaxX = new Float64Array(h).fill(-1);
  let total = 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;
      if (luma < 30) continue; // near-black is noise, not a face in shadow
      const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
      const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
      if (cb < 77 || cb > 127 || cr < 133 || cr > 173) continue;
      rowCount[y]++;
      rowSumX[y] += x;
      if (x < rowMinX[y]) rowMinX[y] = x;
      if (x > rowMaxX[y]) rowMaxX[y] = x;
      total++;
    }
  }

  if (total < w * h * MIN_SKIN_FRACTION) return null;

  // Top edge of the skin, at the 8th percentile rather than the very first
  // pixel, so a stray warm-coloured speck in the background doesn't define it.
  let seen = 0;
  let yTop = 0;
  for (let y = 0; y < h; y++) {
    seen += rowCount[y];
    if (seen >= total * 0.08) {
      yTop = y;
      break;
    }
  }

  // Walk down from there and stop at the end of the head. Two things end it:
  // a gap (background between chin and body), or the row suddenly getting much
  // wider than anything above it — that's shoulders, which are roughly twice
  // the width of a head. Without the width test, a neck joins the face to the
  // torso in one unbroken run and the centroid slides down the chest.
  const widthAt = (y: number) => (rowMaxX[y] >= 0 ? rowMaxX[y] - rowMinX[y] + 1 : 0);
  let maxW = 0;
  let yEnd = yTop;
  for (let y = yTop; y < h; y++) {
    const rowW = widthAt(y);
    if (rowW === 0) break;
    if (maxW >= w * 0.08 && rowW > maxW * 1.8) break;
    maxW = Math.max(maxW, rowW);
    yEnd = y;
  }

  let bandCount = 0;
  let bandSumX = 0;
  let bandSumY = 0;
  for (let y = yTop; y <= yEnd; y++) {
    bandCount += rowCount[y];
    bandSumX += rowSumX[y];
    bandSumY += rowCount[y] * y;
  }
  if (bandCount === 0) return null;

  // Nudge upward: what's visible is the face below the hairline, so its
  // centroid sits low of the eyes, which is what you actually want centred.
  const bandH = yEnd - yTop + 1;
  return {
    x: bandSumX / bandCount / w,
    y: Math.max(0, bandSumY / bandCount - bandH * 0.12) / h,
  };
}

/** Best-effort starting position for the crop. Returns null when there's
 * nothing to go on, and the caller should just centre. */
export async function detectFocalPoint(img: HTMLImageElement): Promise<FocalPoint | null> {
  return (await detectWithPlatformApi(img)) ?? detectByTone(img);
}
