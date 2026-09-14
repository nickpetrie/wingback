// The team sheet composes text straight into an SVG that sharp rasterises —
// there is no DOM, no canvas, and so no real text-measurement API available
// at compose time. These factors stand in for one, and the only thing that
// matters about them is that they never *under*-report: an under-estimate
// doesn't shorten a name, it lets the renderer draw it straight off the edge
// of its caption plate and onto the photo.
//
// One factor for everything was doing exactly that. Measured through the real
// render path — drawing each string with sharp and trimming to the ink — a
// bold uppercase caption runs to 0.673 of its nominal em where mixed-case
// bold sits nearer 0.61, so a flat 0.6 under-reported "ALEXANDER BEETLES · £6"
// by 42px and it spilled. Both numbers below are the measured worst case plus
// a little margin.
export const WIDTH_FACTOR = {
  /** Mixed-case bold, as the player name is drawn. */
  display: 0.66,
  /** Uppercase bold with letter-spacing, as the entrant line is drawn — the
   * widest per character anything here gets. */
  caption: 0.7,
} as const;

export function estimateTextWidth(
  text: string,
  fontSize: number,
  factor: number = WIDTH_FACTOR.caption,
): number {
  return text.length * fontSize * factor;
}

/** The largest of `sizes` (tried largest first) that's estimated to fit
 * `text` within `maxWidth` — so a short name gets the full heading size and
 * a long one steps down before it gets truncated at all. Falls back to the
 * smallest size if even that doesn't fit; `fitLabel` handles the rest. */
export function fitFontSize(
  text: string,
  maxWidth: number,
  sizes: number[],
  factor: number = WIDTH_FACTOR.caption,
): number {
  for (const size of sizes) {
    if (estimateTextWidth(text, size, factor) <= maxWidth) return size;
  }
  return sizes[sizes.length - 1];
}

/** `text` if it fits at `fontSize`, otherwise the longest prefix that does,
 * with an ellipsis. Player and entrant names are short enough in practice
 * that this rarely fires, but a long enough one (a hyphenated surname, a
 * renamed entrant) must not be left to overflow its card. */
export function fitLabel(
  text: string,
  maxWidth: number,
  fontSize: number,
  factor: number = WIDTH_FACTOR.caption,
): string {
  if (estimateTextWidth(text, fontSize, factor) <= maxWidth) return text;
  for (let len = text.length - 1; len > 0; len--) {
    const candidate = text.slice(0, len).trimEnd() + "…";
    if (estimateTextWidth(candidate, fontSize, factor) <= maxWidth) return candidate;
  }
  return text.slice(0, 1);
}

/** The handful of characters that break well-formed SVG/XML if they land in
 * a name unescaped — an apostrophe in a surname is the one that actually
 * occurs in this squad list, but all five are cheap to cover. */
export function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
