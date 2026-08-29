// Generates every app icon from one SVG, so the set is editable rather than
// four PNGs nobody can change. Run with `npm run icons`.
//
// The mark is the wordmark's W over the pitch geometry from the login hero —
// the same centre circle and penalty arc, at the same weight. Nothing here is
// a new idea: the icon should look like the app it opens, and the app is flat,
// square-cornered, pitch green, with 2px lines.
//
// Drawn as stroked paths rather than SVG text on purpose. Text would need
// Archivo available to whatever rasteriser runs this, and a missing font
// substitutes silently — you would get an icon in the wrong typeface and no
// error to tell you.

import { mkdirSync, writeFileSync } from "node:fs";
import sharp from "sharp";

// Straight from globals.css. The icon sits on the light theme's accent
// because a home screen has no theme to follow.
const GREEN = "#1b8a52";
const OFF_WHITE = "#f3f2f2";

/** The W, as a polyline stroked with mitred joins.
 *
 * `scale` shrinks the mark within the 512 box without moving its centre,
 * which is what the maskable variant needs: Android crops to its own shape,
 * so anything outside the middle 80% can be sliced off. */
function mark(scale = 1) {
  const c = 256;
  const at = (v) => c + (v - c) * scale;

  // Four strokes, one path. The middle peak stops short of the cap height —
  // a W whose centre reaches the top reads as two overlapping Vs.
  //
  // The y values sit 37px above where the mark looks like it should start,
  // because a mitred join on a V this sharp throws its point well past the
  // vertex it is drawn from: the geometry ran 150→374, the ink came out
  // 142→443, and the mark sat visibly low in the tile. These numbers are
  // chosen so the *ink* is centred, which is the only thing anyone sees.
  const d = [
    `M ${at(102)},${at(113)}`,
    `L ${at(180)},${at(337)}`,
    `L ${at(256)},${at(175)}`,
    `L ${at(332)},${at(337)}`,
    `L ${at(410)},${at(113)}`,
  ].join(" ");

  return `<path d="${d}" fill="none" stroke="${OFF_WHITE}"
    stroke-width="${54 * scale}" stroke-linejoin="miter" stroke-linecap="butt"
    stroke-miterlimit="8" />`;
}

/** The pitch lines behind it: a centre circle and the arc of a penalty area,
 * cropped by the tile edge exactly as they are on the login hero. Low contrast
 * on purpose — at 60px on a home screen this should read as texture, not as
 * lines competing with the W. */
function pitch() {
  const line = `fill="none" stroke="${OFF_WHITE}" stroke-opacity="0.17" stroke-width="9"`;
  return `
    <circle cx="470" cy="470" r="150" ${line} />
    <path d="M 256 512 V 400 a 150 150 0 0 1 150 -150 H 512" ${line} />
    <circle cx="60" cy="60" r="74" ${line} />`;
}

function svg({ scale = 1, background = GREEN } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${background}" />
  ${pitch()}
  ${mark(scale)}
</svg>`;
}

const outputs = [
  // Android / PWA.
  { file: "public/icon-192.png", size: 192, svg: svg() },
  { file: "public/icon-512.png", size: 512, svg: svg() },
  // Maskable: Android crops to a circle, squircle or rounded square depending
  // on the launcher, and guarantees only the middle 80%. The mark shrinks to
  // sit inside that; the background bleeds to the edge so no crop shows a gap.
  { file: "public/icon-maskable-512.png", size: 512, svg: svg({ scale: 0.72 }) },
  // iOS applies its own rounded-rectangle mask and no padding, so this one is
  // the full-bleed mark.
  { file: "public/apple-touch-icon.png", size: 180, svg: svg() },
];

mkdirSync("public", { recursive: true });

for (const { file, size, svg: source } of outputs) {
  const png = await sharp(Buffer.from(source))
    .resize(size, size)
    // No alpha: iOS composites a transparent icon onto black, which turns the
    // green field into a dark smear.
    .flatten({ background: GREEN })
    .png({ compressionLevel: 9 })
    .toBuffer();
  writeFileSync(file, png);
  console.log(`${file}  ${size}×${size}  ${(png.length / 1024).toFixed(1)}kB`);
}
