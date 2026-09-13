import { describe, expect, it } from "vitest";
import { escapeXml, estimateTextWidth, fitFontSize, fitLabel } from "./textFit";

describe("estimateTextWidth", () => {
  it("grows with both length and font size", () => {
    expect(estimateTextWidth("Haaland", 24)).toBeCloseTo(7 * 24 * 0.6);
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
