// Approximate primary shirt colours, keyed by FPL's team short_name. This
// covers every club with a recent Premier League stint; a promoted club we
// don't recognise still gets a deterministic (not random-each-render)
// colour from the hash fallback rather than breaking the card.
const KNOWN: Record<string, string> = {
  ARS: "#EF0107",
  AVL: "#670E36",
  BOU: "#DA291C",
  BRE: "#E30613",
  BHA: "#0057B8",
  BUR: "#6C1D45",
  CHE: "#034694",
  CRY: "#1B458F",
  EVE: "#003399",
  FUL: "#000000",
  IPS: "#0044A5",
  LEE: "#FFCD00",
  LEI: "#003090",
  LIV: "#C8102E",
  LUT: "#F78F1E",
  MCI: "#6CABDD",
  MUN: "#DA291C",
  NEW: "#241F20",
  NFO: "#DD0000",
  NOR: "#00A650",
  SHU: "#EE2737",
  SOU: "#D71920",
  SUN: "#EB172B",
  TOT: "#132257",
  WAT: "#FBEE23",
  WBA: "#122F67",
  WHU: "#7A263A",
  WOL: "#FDB913",
};

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (n: number) => Math.round(f(n) * 255).toString(16).padStart(2, "0");
  return `#${toHex(0)}${toHex(8)}${toHex(4)}`;
}

function hashColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return hslToHex(Math.abs(hash) % 360, 55, 35);
}

/** Always a `#rrggbb` hex string, so callers can feed it straight into sharp/SVG. */
export function teamColor(shortName: string): string {
  return KNOWN[shortName] ?? hashColor(shortName);
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/** The two colours text on a shirt can be. Literal, not `var(--color-text)`:
 * that token flips light in the dark theme, and a club's yellow does not. */
export const ON_DARK_SHIRT = "#ffffff";
export const ON_LIGHT_SHIRT = "#201e1d";

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance, 0 (black) to 1 (white). */
export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** White or dark, whichever reads better on the colour given. Chosen by
 * comparing the two ratios rather than by a luminance cut-off: City's blue
 * (#6CABDD) has a luminance of 0.375, which a "0.4 means light" threshold
 * would still have called dark enough for white — at 2.47:1, against 6.73:1
 * for dark text on it. */
export function contrastText(hex: string): string {
  return contrastRatio(ON_LIGHT_SHIRT, hex) > contrastRatio(ON_DARK_SHIRT, hex)
    ? ON_LIGHT_SHIRT
    : ON_DARK_SHIRT;
}

/** Text colour for anything painted in `teamColor(shortName)`. */
export function teamTextColor(shortName: string): string {
  return contrastText(teamColor(shortName));
}
