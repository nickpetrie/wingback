import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contrastRatio } from "../lib/teamColors";

// The secondary-text tokens are literal hex precisely so this can be a
// number: every inline color-mix they replaced was under 4.5:1 in the light
// theme (55% of the text colour on #f3f2f2 is 3.66:1), and nothing but a
// measurement would have caught it. Read straight from the stylesheet, so
// a retuned token is checked the moment it lands.
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

function tokens(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/--(color-[a-z0-9-]+):\s*(#[0-9a-f]{6})\s*;/gi)) out[m[1]] = m[2].toLowerCase();
  return out;
}

const light = tokens(css.slice(css.indexOf(":root {"), css.indexOf(':root[data-theme="dark"]')));
const dark = tokens(css.slice(css.indexOf(':root[data-theme="dark"]')));

describe.each([
  ["light", light],
  ["dark", dark],
])("%s theme text contrast", (_name, t) => {
  it("has the tokens this is about", () => {
    for (const k of ["color-bg", "color-surface", "color-text", "color-accent", "color-text-muted", "color-text-faint", "color-accent-text"]) {
      expect(t[k], k).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("muted text reaches 4.5:1 on the page and on a card", () => {
    expect(contrastRatio(t["color-text-muted"], t["color-bg"])).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(t["color-text-muted"], t["color-surface"])).toBeGreaterThanOrEqual(4.5);
  });

  it("faint text reaches 3:1 — it is decoration, never the only copy of a fact", () => {
    expect(contrastRatio(t["color-text-faint"], t["color-bg"])).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(t["color-text-faint"], t["color-surface"])).toBeGreaterThanOrEqual(3);
  });

  it("accent text reaches 4.5:1, and a page-coloured label on it does too", () => {
    expect(contrastRatio(t["color-accent-text"], t["color-bg"])).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(t["color-accent-text"], t["color-surface"])).toBeGreaterThanOrEqual(4.5);
    // .btn-primary: the label is --color-bg on an --color-accent-text fill.
    expect(contrastRatio(t["color-bg"], t["color-accent-text"])).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps body text where it was", () => {
    expect(contrastRatio(t["color-text"], t["color-bg"])).toBeGreaterThanOrEqual(7);
  });
});

it("the stylesheet fills the accent-as-text roles from the text token, not the fill", () => {
  // The rules that put the accent on words rather than boxes.
  for (const selector of ["a", ".card-kicker", ".wb-team-row-hint", ".btn-ghost", ".wb-board-points", ".wb-header-countdown"]) {
    const start = css.indexOf(`\n${selector} {`);
    expect(start, selector).toBeGreaterThan(-1);
    const rule = css.slice(start, css.indexOf("}", start));
    expect(rule, selector).toMatch(/color: var\(--color-accent-text\)/);
  }
});
