import sharp from "sharp";
import { escapeXml, estimateTextWidth, fitFontSize, fitLabel, WIDTH_FACTOR } from "./textFit";
import type { Stake } from "./supabase/types";

// 1080×1350 (4:5) rather than a square or 16:9: it's the shape WhatsApp,
// Instagram and iMessage all render at close to full width without cropping
// the preview, so more of the image is visible before anyone taps it — a
// square loses width-vs-height efficiency and anything wider than 4:5 gets
// letterboxed or cropped by those same previews. Portrait also happens to be
// what a formation actually wants: rows of players stacked up a pitch, not
// across one.
const WIDTH = 1080;
const HEIGHT = 1350;

// A shared PNG can't read a CSS custom property, so these are the light
// theme's tokens from globals.css, copied by hand. Light rather than
// following the viewer's own theme: the one thing every WhatsApp thread
// guarantees is a light chat background, and a dark sheet would look like a
// rendering error dropped into it.
const COLOR_BG = "#f3f2f2";
const COLOR_TEXT = "#201e1d";
const COLOR_ACCENT = "#1b8a52";
const COLOR_ACCENT_600 = "#167445";
const COLOR_GOLD = "#c8951b";
const WHITE = "#ffffff";

const PAD_X = 48;
const HEADER_H = 118;
const FOOTER_H = 38;
const PITCH_TOP = HEADER_H;
const PITCH_BOTTOM = HEIGHT - FOOTER_H;

// Breathing room inside the pitch band before rows start, not space reserved
// "for" the markings — the markings are drawn under wherever the rows land,
// the way players in a real formation graphic stand inside the box rather
// than around it.
const ROWS_TOP_PAD = 18;
const ROWS_BOTTOM_PAD = 18;
const ROW_GAP = 30; // rotation grows each card's bounding box a little at the edges it touches its neighbours — this is the gap sized to absorb that, not the gap itself
const CARD_GAP = 42;

const BORDER = 12; // the sticker's white (or gold) peel edge
const MAX_STICKER = 380;
const MIN_STICKER = 110;

// A real formation still only has one entrant per position most weeks —
// this is what stops the rare "everyone picked a forward" gameweek from
// cramming five stickers into one row so narrow the names are unreadable.
// A position with more than this wraps into its own extra row instead,
// still grouped together, just stacked.
const MAX_PER_ROW = 3;

export interface TeamSheetEntry {
  entrantName: string;
  playerName: string;
  teamShortName: string;
  stake: Stake;
  /** 1 GK, 2 DEF, 3 MID, 4 FWD — see CLAUDE.md. Decides which row of the
   * formation the sticker lands in. */
  elementType: number;
  /** Pre-rendered player card PNG (from `renderPlayerCard`), square. */
  cardBuffer: Buffer;
}

// Back row (GK) to front row (FWD) — "keepers at the back, then defenders,
// midfielders, forwards up front" — but drawn top-to-bottom with forwards
// nearest the opponent's goal (the penalty box) at the top of the image, the
// way every formation graphic reads: attacking end up, own end down.
const ROW_ORDER = [4, 3, 2, 1] as const;

function stickerAngle(seed: string, index: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const magnitude = 2 + (Math.abs(hash) % 4); // 2..5 degrees — crooked, not tilted over
  return index % 2 === 0 ? magnitude : -magnitude;
}

/** The pitch: mown stripes in the app's own green pair, a sideline, and just
 * enough of the markings (halfway line, centre circle, one penalty box) to
 * read as "pitch" rather than "green rectangle" at a glance — flat colour
 * blocks throughout, no gradients, matching how the rest of the app draws
 * things. */
function pitchSvg(): string {
  const stripeCount = 13;
  const h = PITCH_BOTTOM - PITCH_TOP;
  const stripeH = h / stripeCount;
  let stripes = "";
  for (let i = 0; i < stripeCount; i++) {
    const y = PITCH_TOP + i * stripeH;
    stripes += `<rect x="0" y="${y.toFixed(2)}" width="${WIDTH}" height="${(stripeH + 1).toFixed(2)}" fill="${i % 2 === 0 ? COLOR_ACCENT : COLOR_ACCENT_600}" />`;
  }

  const midY = PITCH_TOP + h / 2;
  const circleR = 130;
  const boxW = 660;
  const boxH = 210;
  const boxX = (WIDTH - boxW) / 2;
  const sixW = 340;
  const sixH = 88;
  const sixX = (WIDTH - sixW) / 2;
  const line = (attrs: string) => `<${attrs} fill="none" stroke="${WHITE}" stroke-width="5" opacity="0.9" />`;

  return `
    ${stripes}
    <rect x="4" y="${PITCH_TOP + 4}" width="${WIDTH - 8}" height="${h - 8}" fill="none" stroke="${WHITE}" stroke-width="5" opacity="0.9" />
    ${line(`line x1="0" y1="${midY}" x2="${WIDTH}" y2="${midY}"`)}
    ${line(`circle cx="${WIDTH / 2}" cy="${midY}" r="${circleR}"`)}
    <circle cx="${WIDTH / 2}" cy="${midY}" r="6" fill="${WHITE}" opacity="0.9" />
    ${line(`rect x="${boxX}" y="${PITCH_TOP}" width="${boxW}" height="${boxH}"`)}
    ${line(`rect x="${sixX}" y="${PITCH_TOP}" width="${sixW}" height="${sixH}"`)}
  `;
}

function headerSvg(gameweekId: number): string {
  const gwLabel = `GAMEWEEK ${gameweekId}`;
  const chipW = gwLabel.length * 24 * 0.62 + 44;
  const chipH = 58;
  const chipY = (HEADER_H - chipH) / 2;

  return `
    <rect x="0" y="0" width="${WIDTH}" height="${HEADER_H}" fill="${COLOR_TEXT}" />
    <rect x="${PAD_X}" y="${chipY}" width="${chipW}" height="${chipH}" fill="${COLOR_ACCENT}" />
    <text x="${PAD_X + chipW / 2}" y="${chipY + chipH / 2}" font-family="system-ui, sans-serif" font-weight="800"
          font-size="24" letter-spacing="1" fill="${COLOR_BG}" text-anchor="middle" dominant-baseline="central">${escapeXml(gwLabel)}</text>
    <text x="${WIDTH - PAD_X}" y="${HEADER_H / 2 - 8}" font-family="system-ui, sans-serif" font-weight="800" font-size="32"
          letter-spacing="1" fill="${COLOR_ACCENT}" text-anchor="end" dominant-baseline="central">WINGBACK</text>
    <text x="${WIDTH - PAD_X}" y="${HEADER_H / 2 + 22}" font-family="system-ui, sans-serif" font-weight="600" font-size="14"
          letter-spacing="2" fill="rgba(243,242,242,0.6)" text-anchor="end">TEAM OF THE WEEK</text>`;
}

function footerSvg(): string {
  return `
    <rect x="0" y="${HEIGHT - FOOTER_H}" width="${WIDTH}" height="${FOOTER_H}" fill="${COLOR_TEXT}" />
    <text x="${WIDTH / 2}" y="${HEIGHT - FOOTER_H / 2}" font-family="system-ui, sans-serif" font-size="15"
          fill="rgba(243,242,242,0.6)" text-anchor="middle" dominant-baseline="central">wingbacksweepstake.website</text>`;
}

/** Entries grouped by position (back to front), each position's own entries
 * then chunked to `MAX_PER_ROW` — the row a sticker draws in, not a model of
 * the position itself, so a crowded position becomes two adjacent rows
 * rather than one unreadably narrow one. */
function layoutRows(entries: TeamSheetEntry[]): TeamSheetEntry[][] {
  const rows: TeamSheetEntry[][] = [];
  for (const elementType of ROW_ORDER) {
    const positionEntries = entries.filter((e) => e.elementType === elementType);
    for (let i = 0; i < positionEntries.length; i += MAX_PER_ROW) {
      rows.push(positionEntries.slice(i, i + MAX_PER_ROW));
    }
  }
  return rows;
}

/** One sticker: photo + a solid caption plate, framed in a white (or, for a
 * doubled stake, gold) border, rotated a few degrees so it sits crooked on
 * the pitch the way a real sticker sits crooked in an album. Assembled and
 * rotated as one unit before it's composited onto the pitch, so the frame,
 * photo and caption all turn together. */
async function renderSticker(entry: TeamSheetEntry, size: number, angle: number): Promise<Buffer> {
  const cardW = size + BORDER * 2;
  const cardH = size + BORDER * 2;
  const doubled = entry.stake === 6;
  const frameColor = doubled ? COLOR_GOLD : WHITE;
  const capBg = doubled ? COLOR_GOLD : COLOR_TEXT;
  const capFg = doubled ? COLOR_TEXT : WHITE;

  const capH = Math.round(Math.max(72, Math.min(94, size * 0.42)));
  const capY = BORDER + size - capH;
  const capPadX = 14;
  const innerW = size - capPadX * 2;

  const nameSize = fitFontSize(entry.playerName, innerW, [32, 28, 26], WIDTH_FACTOR.display);
  const nameLabel = fitLabel(entry.playerName, innerW, nameSize, WIDTH_FACTOR.display);

  // No "· £3" on the ordinary ones. The stake only carries meaning when it is
  // doubled, and that is already said by the whole sticker turning gold — so
  // printing it on every card spent the width that was truncating "Alex
  // Beetles" into "ALEX BEETL…" to say nothing at all.
  const entrantSize = 24;
  // Falling back to the first name beats an ellipsis. There are five of them
  // and they know each other — "ALEXANDER" is a person, "ALEXANDER B…" is a
  // rendering artefact. Only if even that won't fit does it get truncated.
  const suffix = doubled ? " · £6" : "";
  const full = `${entry.entrantName.toUpperCase()}${suffix}`;
  const firstOnly = `${entry.entrantName.split(" ")[0].toUpperCase()}${suffix}`;
  const line2 =
    estimateTextWidth(full, entrantSize) <= innerW ? full : firstOnly;
  const line2Label = fitLabel(line2, innerW, entrantSize);

  const frameSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${cardW}" height="${cardH}">
    <rect width="${cardW}" height="${cardH}" fill="${frameColor}" />
  </svg>`;

  // clipPath, not just a well-fitted string: the width estimate above is
  // measured and generous, but it is still an estimate, and the failure it
  // guards against is text painting across the photo. Clipping makes that
  // impossible rather than unlikely.
  const captionSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${cardW}" height="${cardH}">
    <defs><clipPath id="cap"><rect x="${BORDER}" y="${capY}" width="${size}" height="${capH}" /></clipPath></defs>
    <rect x="${BORDER}" y="${capY}" width="${size}" height="${capH}" fill="${capBg}" />
    <g clip-path="url(#cap)">
    <text x="${BORDER + size / 2}" y="${capY + capH * 0.4}" font-family="system-ui, sans-serif" font-weight="800"
          font-size="${nameSize}" fill="${capFg}" text-anchor="middle" dominant-baseline="central">${escapeXml(nameLabel)}</text>
    <text x="${BORDER + size / 2}" y="${capY + capH * 0.76}" font-family="system-ui, sans-serif" font-weight="700"
          font-size="${entrantSize}" letter-spacing="0.5" fill="${capFg}" opacity="0.9" text-anchor="middle" dominant-baseline="central">${escapeXml(line2Label)}</text>
    </g>
  </svg>`;

  const photoResized = await sharp(entry.cardBuffer).resize(size, size, { fit: "cover" }).toBuffer();

  const assembled = await sharp(Buffer.from(frameSvg))
    .composite([
      { input: photoResized, left: BORDER, top: BORDER },
      { input: Buffer.from(captionSvg), left: 0, top: 0 },
    ])
    .png()
    .toBuffer();

  return sharp(assembled)
    .rotate(angle, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}

/**
 * The picks for one gameweek laid out as a formation on a pitch — the
 * shareable image behind `/api/team-sheet/[gameweek]`. Only ever called for
 * a locked gameweek, so this is a snapshot of something that can no longer
 * change; that's what makes it safe to cache forever, and why the sticker
 * rotation is derived from the pick's own content rather than randomised —
 * the same locked gameweek must render the same bytes every time.
 */
export async function renderTeamSheet(gameweekId: number, entries: TeamSheetEntry[]): Promise<Buffer> {
  const rows = layoutRows(entries);
  const numRows = Math.max(rows.length, 1);
  const maxRowCount = Math.max(...rows.map((r) => r.length), 1);

  const bodyWidth = WIDTH - PAD_X * 2;
  const sizeFromWidth = (bodyWidth - CARD_GAP * (maxRowCount - 1)) / maxRowCount - BORDER * 2;

  const usableH = PITCH_BOTTOM - PITCH_TOP - ROWS_TOP_PAD - ROWS_BOTTOM_PAD;
  const slotH = usableH / numRows;
  const sizeFromHeight = slotH - ROW_GAP - BORDER * 2;

  const stickerSize = Math.round(
    Math.max(MIN_STICKER, Math.min(MAX_STICKER, sizeFromWidth, sizeFromHeight)),
  );
  const cardBox = stickerSize + BORDER * 2;

  let globalIndex = 0;
  const composites: { input: Buffer; left: number; top: number }[] = [];

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    const rowCenterY = PITCH_TOP + ROWS_TOP_PAD + slotH * (r + 0.5);
    const rowWidth = row.length * cardBox + (row.length - 1) * CARD_GAP;
    const rowStartX = (WIDTH - rowWidth) / 2;

    for (let c = 0; c < row.length; c++) {
      const entry = row[c];
      const centerX = rowStartX + c * (cardBox + CARD_GAP) + cardBox / 2;
      const angle = stickerAngle(`${entry.entrantName}|${entry.playerName}`, globalIndex);
      globalIndex++;

      const rotated = await renderSticker(entry, stickerSize, angle);
      const meta = await sharp(rotated).metadata();
      const w = meta.width ?? cardBox;
      const h = meta.height ?? cardBox;

      composites.push({
        input: rotated,
        left: Math.round(centerX - w / 2),
        top: Math.round(rowCenterY - h / 2),
      });
    }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
    <rect width="${WIDTH}" height="${HEIGHT}" fill="${COLOR_BG}" />
    ${pitchSvg()}
    ${headerSvg(gameweekId)}
    ${footerSvg()}
  </svg>`;

  // Stickers composite on top of the rasterised pitch/header/footer base
  // rather than being drawn as more SVG: each one already carries its own
  // rasterised (posterised or monogram) photo, so it has to go through
  // sharp's raster compositing, not the SVG layer.
  return sharp(Buffer.from(svg)).composite(composites).png().toBuffer();
}
