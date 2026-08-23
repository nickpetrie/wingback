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
