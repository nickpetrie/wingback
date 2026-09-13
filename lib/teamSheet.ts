import sharp from "sharp";
import { escapeXml, fitFontSize, fitLabel } from "@/lib/textFit";
import type { Stake } from "@/lib/supabase/types";

// 1200 wide keeps five ~190px player cards legible on a phone screen with
// room for two lines of caption under each. The height (530, not the 1200×675
// "16:9" starting point suggested in the brief) is instead sized to what
// the content actually needs — a header band plus one row of cards with no
// dead space below them — measured by generating the image and looking at
// it: 675 left roughly 180px of empty card below the stake tag. Still
// unambiguously landscape (~2.26:1), which is all "reads well as a WhatsApp
// photo" requires.
const WIDTH = 1200;
const HEIGHT = 530;

// A shared PNG can't read a CSS custom property, so these are the light
// theme's tokens from globals.css, copied by hand. Light rather than
// following the viewer's own theme: the one thing every WhatsApp thread
// guarantees is a light chat background, and a dark sheet would look like a
// rendering error dropped into it.
const COLOR_BG = "#f3f2f2";
const COLOR_SURFACE = "#eae9e9";
const COLOR_TEXT = "#201e1d";
const COLOR_ACCENT = "#1b8a52";
const COLOR_NEUTRAL_200 = "#eae7e7";
const COLOR_NEUTRAL_800 = "#444141";
const COLOR_DIVIDER = "rgba(32,30,29,0.35)";

const PAD_X = 40;
const HEADER_H = 108;
const BODY_TOP = HEADER_H + 26;
const COL_GAP = 16;

// The card's internal vertical rhythm, named rather than threaded through as
// magic numbers — photoSize is the one thing that varies (it shrinks once
// five columns no longer fit at the cap), everything below it is fixed
// spacing hung off wherever the photo ends.
const CARD_PAD_TOP = 20;
const MAX_PHOTO_SIZE = 190;
const GAP_PHOTO_TO_ENTRANT = 30;
const GAP_ENTRANT_TO_NAME = 28;
const GAP_NAME_TO_TAG = 20;
const TAG_HEIGHT = 28;
const CARD_PAD_BOTTOM = 24;

// Fixed at the worst case (photoSize at its cap) rather than derived per
// render, so every gameweek's sheet — five pickers or three — gets the same
// card height and the same footer position.
const BODY_BOTTOM =
  BODY_TOP +
  CARD_PAD_TOP +
  MAX_PHOTO_SIZE +
  GAP_PHOTO_TO_ENTRANT +
  GAP_ENTRANT_TO_NAME +
  GAP_NAME_TO_TAG +
  TAG_HEIGHT +
  CARD_PAD_BOTTOM;

export interface TeamSheetEntry {
  entrantName: string;
  playerName: string;
  teamShortName: string;
  stake: Stake;
  /** Pre-rendered player card PNG (from `renderPlayerCard`), square. */
  cardBuffer: Buffer;
}

function chip(label: string, cx: number, y: number, bg: string, fg: string, fontSize = 14): string {
  const width = label.length * fontSize * 0.62 + 24;
  const height = fontSize + 14;
  const x = cx - width / 2;
  return `
    <rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${bg}" />
    <text x="${cx}" y="${y + height / 2}" font-family="system-ui, sans-serif" font-weight="700"
          font-size="${fontSize}" fill="${fg}" text-anchor="middle" dominant-baseline="central">${escapeXml(label)}</text>`;
}

function columnSvg(entry: TeamSheetEntry, x: number, colWidth: number, photoSize: number): string {
  const innerWidth = colWidth - 24;
  const photoY = BODY_TOP + CARD_PAD_TOP;

  const entrantY = photoY + photoSize + GAP_PHOTO_TO_ENTRANT;
  const entrantLabel = fitLabel(entry.entrantName.toUpperCase(), innerWidth, 13);

  const nameSize = fitFontSize(entry.playerName, innerWidth, [26, 22, 19]);
  const nameY = entrantY + GAP_ENTRANT_TO_NAME;
  const nameLabel = fitLabel(entry.playerName, innerWidth, nameSize);

  const tagY = nameY + GAP_NAME_TO_TAG;
  const stakeLabel = entry.stake === 6 ? "£6 · DOUBLED" : "£3";
  const stakeBg = entry.stake === 6 ? COLOR_ACCENT : COLOR_NEUTRAL_200;
  const stakeFg = entry.stake === 6 ? COLOR_BG : COLOR_NEUTRAL_800;
  const teamLabel = entry.teamShortName || "—";

  // Two chips side by side, centred as a pair rather than each centred on
  // its own — otherwise a short "£3" and a longer team code visibly don't
  // line up with each other from card to card.
  const teamChipWidth = teamLabel.length * 13 * 0.62 + 24;
  const stakeChipWidth = stakeLabel.length * 14 * 0.62 + 24;
  const pairWidth = teamChipWidth + stakeChipWidth + 10;
  const pairLeft = x + colWidth / 2 - pairWidth / 2;

  return `
    <rect x="${x}" y="${BODY_TOP}" width="${colWidth}" height="${BODY_BOTTOM - BODY_TOP}" fill="${COLOR_SURFACE}" />
    <text x="${x + colWidth / 2}" y="${entrantY}" font-family="system-ui, sans-serif" font-weight="700"
          font-size="13" letter-spacing="1.5" fill="${COLOR_DIVIDER}" text-anchor="middle">${escapeXml(entrantLabel)}</text>
    <text x="${x + colWidth / 2}" y="${nameY}" font-family="system-ui, sans-serif" font-weight="800"
          font-size="${nameSize}" fill="${COLOR_TEXT}" text-anchor="middle">${escapeXml(nameLabel)}</text>
    ${chip(teamLabel, pairLeft + teamChipWidth / 2, tagY, COLOR_NEUTRAL_200, COLOR_NEUTRAL_800, 13)}
    ${chip(stakeLabel, pairLeft + teamChipWidth + 10 + stakeChipWidth / 2, tagY, stakeBg, stakeFg, 14)}`;
}

function headerSvg(gameweekId: number): string {
  const gwLabel = `GAMEWEEK ${gameweekId}`;
  const gwChipWidth = gwLabel.length * 22 * 0.6 + 40;

  return `
    <rect x="0" y="0" width="${WIDTH}" height="${HEADER_H}" fill="${COLOR_TEXT}" />
    <rect x="${PAD_X}" y="26" width="${gwChipWidth}" height="46" fill="${COLOR_ACCENT}" />
    <text x="${PAD_X + gwChipWidth / 2}" y="49" font-family="system-ui, sans-serif" font-weight="800"
          font-size="22" letter-spacing="1" fill="${COLOR_BG}" text-anchor="middle" dominant-baseline="central">${escapeXml(gwLabel)}</text>
    <text x="${PAD_X}" y="90" font-family="system-ui, sans-serif" font-weight="600" font-size="13"
          letter-spacing="2" fill="rgba(243,242,242,0.6)">TEAM OF THE WEEK</text>
    <text x="${WIDTH - PAD_X}" y="58" font-family="system-ui, sans-serif" font-weight="800" font-size="28"
          letter-spacing="1" fill="${COLOR_ACCENT}" text-anchor="end" dominant-baseline="central">WINGBACK</text>`;
}

/**
 * Five (or fewer, if someone missed the gameweek) player cards laid out as
 * one team sheet — the shareable image behind `/api/team-sheet/[gameweek]`.
 * Only ever called for a locked gameweek, so this is a snapshot of something
 * that can no longer change; that's what makes it safe to cache forever.
 */
export async function renderTeamSheet(gameweekId: number, entries: TeamSheetEntry[]): Promise<Buffer> {
  const n = Math.max(entries.length, 1);
  const colWidth = (WIDTH - PAD_X * 2 - COL_GAP * (n - 1)) / n;
  const photoSize = Math.floor(Math.min(colWidth - 40, MAX_PHOTO_SIZE));

  const columns = entries
    .map((entry, i) => columnSvg(entry, PAD_X + i * (colWidth + COL_GAP), colWidth, photoSize))
    .join("");

  const footer = `
    <text x="${WIDTH / 2}" y="${BODY_BOTTOM + 32}" font-family="system-ui, sans-serif" font-size="11"
          fill="${COLOR_DIVIDER}" text-anchor="middle">wingbacksweepstake.website</text>`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
    <rect width="${WIDTH}" height="${HEIGHT}" fill="${COLOR_BG}" />
    ${headerSvg(gameweekId)}
    ${columns}
    ${footer}
  </svg>`;

  const base = sharp(Buffer.from(svg));

  const photoComposites = await Promise.all(
    entries.map(async (entry, i) => {
      const x = PAD_X + i * (colWidth + COL_GAP);
      const resized = await sharp(entry.cardBuffer).resize(photoSize, photoSize, { fit: "cover" }).toBuffer();
      return {
        input: resized,
        left: Math.round(x + (colWidth - photoSize) / 2),
        top: BODY_TOP + CARD_PAD_TOP,
      };
    }),
  );

  return base.composite(photoComposites).png().toBuffer();
}
