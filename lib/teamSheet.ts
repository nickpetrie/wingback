import { join } from "node:path";
import sharp from "sharp";
import type { Stake } from "./supabase/types";

// The five picks for one gameweek as a single portrait image, sized to be
// opened on a phone in a chat thread.
//
// Two things this deliberately does NOT do, both learned the hard way:
//
// It asks for no font by name. The first deployed version drew every glyph as
// a tofu box — fine locally, boxes on Vercel — because the SVG asked for
// `system-ui, sans-serif` and nothing in the serverless runtime matched. A
// missing font does not raise, it just draws boxes. Every string here is
// rendered by sharp from the font file committed in assets/fonts, by absolute
// path, so there is nothing left to resolve.
//
// And it is not a designed scene. It had a pitch, a formation and rotated
// stickers, which was more styling than the thing wanted: the fun is supposed
// to be in the player images, which renderPlayerCard already provides, not in
// the furniture around them.

const FONT_DIR = join(process.cwd(), "assets", "fonts");
const FONT_BOLD = join(FONT_DIR, "DejaVuSans-Bold.ttf");
const FONT_REGULAR = join(FONT_DIR, "DejaVuSans.ttf");

// 4:5. The portrait ratio a chat thread previews closest to full width
// without cropping, which is the only viewing condition that matters here.
const WIDTH = 1080;
const HEIGHT = 1350;

// Lifted from the light theme in globals.css. A shared PNG cannot read a CSS
// custom property, and light rather than following the viewer's theme because
// a chat background is always light — a dark sheet dropped into one reads as
// a rendering error.
const BG = "#f3f2f2";
const INK = "#201e1d";
const ACCENT = "#1b8a52";
const GOLD = "#c8951b";
const MUTED = "#6c6867";

const PAD = 56;
const HEADER_H = 190;
const FOOTER_H = 96;

interface TextOptions {
  size: number;
  bold?: boolean;
  color?: string;
  /** Wrap width. Omitted, the line is as wide as it needs to be. */
  width?: number;
}

/** One run of text, rasterised from the committed font file.
 *
 * Pango markup is how sharp takes a colour here, so anything interpolated in
 * has to be escaped — a surname with an ampersand would otherwise end the
 * span and take the rest of the line with it. */
async function textPng(text: string, { size, bold, color = INK, width }: TextOptions) {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const image = sharp({
    text: {
      text: `<span foreground="${color}">${escaped}</span>`,
      font: `DejaVu Sans ${bold ? "Bold " : ""}${size}`,
      fontfile: bold ? FONT_BOLD : FONT_REGULAR,
      rgba: true,
      ...(width ? { width } : {}),
    },
  }).png();
  const { data, info } = await image.toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

export interface TeamSheetEntry {
  entrantName: string;
  playerName: string;
  teamShortName: string;
  stake: Stake;
  /** The posterised card from renderPlayerCard — square. */
  cardBuffer: Buffer;
}

/** A pick's row: the player image, then who has them and at what stake. */
async function row(entry: TeamSheetEntry, rowH: number) {
  // Capped, not just "as tall as the row": a three-pick gameweek has taller
  // rows than a five-pick one, and without this the same sheet renders with
  // comically large portraits whenever two people forget to pick.
  const photo = Math.min(rowH - 26, 210);
  const doubled = entry.stake === 6;

  const [player, entrant, club] = await Promise.all([
    textPng(entry.playerName, { size: 40, bold: true }),
    textPng(entry.entrantName.toUpperCase(), { size: 24, bold: true, color: doubled ? GOLD : ACCENT }),
    textPng(entry.teamShortName, { size: 22, color: MUTED }),
  ]);
  // Only the doubled stake earns a word. £3 is the default and saying so on
  // every row is noise.
  const stake = doubled ? await textPng("£6 DOUBLED", { size: 22, bold: true, color: GOLD }) : null;

  const textX = PAD + photo + 34;
  const NAME_GAP = 18;
  const CLUB_GAP = 10;
  // The photo and the text are centred against each other rather than both
  // hung off the top, so a row reads as one thing at any row height.
  const blockH = player.height + NAME_GAP + entrant.height + CLUB_GAP + club.height;
  const textTop = Math.round((rowH - blockH) / 2);
  const entrantTop = textTop + player.height + NAME_GAP;

  return sharp({
    create: { width: WIDTH, height: rowH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([
      {
        input: await sharp(entry.cardBuffer).resize(photo, photo, { fit: "cover" }).toBuffer(),
        left: PAD,
        top: Math.round((rowH - photo) / 2),
      },
      { input: player.data, left: textX, top: textTop },
      { input: entrant.data, left: textX, top: entrantTop },
      { input: club.data, left: textX, top: entrantTop + entrant.height + CLUB_GAP },
      ...(stake
        ? [{ input: stake.data, left: textX + entrant.width + 20, top: entrantTop + 2 }]
        : []),
    ])
    .png()
    .toBuffer();
}

export async function renderTeamSheet(gameweekId: number, entries: TeamSheetEntry[]): Promise<Buffer> {
  const bodyH = HEIGHT - HEADER_H - FOOTER_H;
  const rowH = Math.floor(bodyH / Math.max(entries.length, 1));

  const [gw, title, brand, foot] = await Promise.all([
    textPng(`GAMEWEEK ${gameweekId}`, { size: 34, bold: true, color: "#ffffff" }),
    textPng("TEAM OF THE WEEK", { size: 46, bold: true, color: "#ffffff" }),
    textPng("WINGBACK", { size: 26, bold: true, color: ACCENT }),
    textPng("wingbacksweepstake.website", { size: 20, color: MUTED }),
  ]);

  const rows = await Promise.all(entries.map((entry) => row(entry, rowH)));

  const chrome = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">
      <rect width="${WIDTH}" height="${HEIGHT}" fill="${BG}" />
      <rect width="${WIDTH}" height="${HEADER_H}" fill="${INK}" />
      ${entries
        .slice(1)
        .map(
          (_, i) =>
            `<rect x="${PAD}" y="${HEADER_H + rowH * (i + 1)}" width="${WIDTH - PAD * 2}" height="2" fill="#dedcdc" />`,
        )
        .join("")}
    </svg>`,
  );

  return sharp(chrome)
    .composite([
      { input: gw.data, left: PAD, top: 42 },
      { input: title.data, left: PAD, top: 96 },
      { input: brand.data, left: WIDTH - PAD - brand.width, top: 52 },
      ...rows.map((input, i) => ({ input, left: 0, top: HEADER_H + rowH * i })),
      { input: foot.data, left: Math.round((WIDTH - foot.width) / 2), top: Math.round(HEIGHT - FOOTER_H / 2 - 12) },
    ])
    .png()
    .toBuffer();
}
