import { describe, expect, it } from "vitest";
import { WIDTH_FACTOR, escapeXml, estimateTextWidth, fitFontSize, fitLabel } from "./textFit";

describe("estimateTextWidth", () => {
  it("grows with both length and font size", () => {
    // Against the exported constant, not a copy of it: the factor is
    // calibrated against measurement and has already moved once.
    expect(estimateTextWidth("Haaland", 24)).toBeCloseTo(7 * 24 * WIDTH_FACTOR.caption);
    expect(estimateTextWidth("", 24)).toBe(0);
  });
});

describe("fitFontSize", () => {
  it("picks the largest size that fits a short name", () => {
    expect(fitFontSize("Saka", 200, [26, 22, 18])).toBe(26);
  });

  it("steps down for a longer name", () => {
    expect(fitFontSize("Alexander-Arnold", 140, [26, 22, 18])).toBe(18);
  });

  it("falls back to the smallest size when nothing fits", () => {
    expect(fitFontSize("A Genuinely Enormous Name Here", 50, [26, 22, 18])).toBe(18);
  });
});

describe("fitLabel", () => {
  it("returns the text unchanged when it already fits", () => {
    expect(fitLabel("Saka", 200, 24)).toBe("Saka");
  });

  it("truncates with an ellipsis when it doesn't", () => {
    const result = fitLabel("Alexander-Arnold", 80, 24);
    expect(result.endsWith("…")).toBe(true);
    expect(result.length).toBeLessThan("Alexander-Arnold".length);
  });

  it("never grows the text", () => {
    const result = fitLabel("Alexander-Arnold", 1, 24);
    expect(result.length).toBeLessThanOrEqual("Alexander-Arnold".length);
  });
});

describe("escapeXml", () => {
  it("escapes the five characters that break SVG text", () => {
    expect(escapeXml(`O'Brien & <Sons> "Ltd"`)).toBe(
      "O&apos;Brien &amp; &lt;Sons&gt; &quot;Ltd&quot;",
    );
  });

  it("leaves ordinary names alone", () => {
    expect(escapeXml("Bruno Fernandes")).toBe("Bruno Fernandes");
  });
});

describe("WIDTH_FACTOR", () => {
  // These are not taste. Each was measured through the real render path —
  // drawing the string with sharp and trimming to the ink — and the estimate
  // existing at all is only useful if it never comes in under the truth:
  // an under-estimate doesn't shorten a name, it lets the renderer paint it
  // off the edge of its caption plate and across the photo, which is exactly
  // what a flat 0.6 was doing to "ALEXANDER BEETLES · £6" (385px measured,
  // 343px estimated).
  const MEASURED = {
    caption: 0.673, // "ALEXANDER BEETLES · £6", 26px, weight 700, uppercase
    display: 0.648, // "Gyökeres", 32px, weight 800, mixed case
  };

  it("never estimates narrower than the widest string actually measured", () => {
    expect(WIDTH_FACTOR.caption).toBeGreaterThanOrEqual(MEASURED.caption);
    expect(WIDTH_FACTOR.display).toBeGreaterThanOrEqual(MEASURED.display);
  });

  it("keeps a fitted label inside the width it was fitted to", () => {
    const names = ["Isak", "Gyökeres", "Bruno Fernandes", "ALEXANDER BEETLES · £6", "Mac Allister"];
    for (const name of names) {
      for (const width of [120, 200, 272, 400]) {
        const label = fitLabel(name, width, 26);
        expect(estimateTextWidth(label, 26)).toBeLessThanOrEqual(width);
      }
    }
  });
});
