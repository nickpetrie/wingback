// The team sheet composes text straight into an SVG that sharp rasterises —
// there is no DOM, no canvas, and so no real text-measurement API available
// at compose time. `estimateTextWidth` is a deliberately crude stand-in: it
// only needs to be conservative enough that long names get shortened before
// the renderer would actually overflow a card, not accurate to the pixel.
const CHAR_WIDTH_FACTOR = 0.6;

export function estimateTextWidth(text: string, fontSize: number): number {
  return text.length * fontSize * CHAR_WIDTH_FACTOR;
}

/** The largest of `sizes` (tried largest first) that's estimated to fit
 * `text` within `maxWidth` — so a short name gets the full heading size and
 * a long one steps down before it gets truncated at all. Falls back to the
 * smallest size if even that doesn't fit; `fitLabel` handles the rest. */
export function fitFontSize(text: string, maxWidth: number, sizes: number[]): number {
  for (const size of sizes) {
    if (estimateTextWidth(text, size) <= maxWidth) return size;
  }
  return sizes[sizes.length - 1];
}

/** `text` if it fits at `fontSize`, otherwise the longest prefix that does,
 * with an ellipsis. Player and entrant names are short enough in practice
 * that this rarely fires, but a long enough one (a hyphenated surname, a
 * renamed entrant) must not be left to overflow its card. */
export function fitLabel(text: string, maxWidth: number, fontSize: number): string {
  if (estimateTextWidth(text, fontSize) <= maxWidth) return text;
  for (let len = text.length - 1; len > 0; len--) {
    const candidate = text.slice(0, len).trimEnd() + "…";
    if (estimateTextWidth(candidate, fontSize) <= maxWidth) return candidate;
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
