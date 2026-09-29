import { describe, expect, it } from "vitest";
import {
  contrastRatio,
  contrastText,
  ON_DARK_SHIRT,
  ON_LIGHT_SHIRT,
  teamColor,
  teamTextColor,
} from "./teamColors";

// White on every shirt was the rule, and on the pale ones it was unreadable:
// City 2.47:1, Leeds 1.50:1, Wolves 1.73:1. These pin the ones that flip to
// dark text and the ones that must not.
describe("teamTextColor", () => {
  it.each(["MCI", "LEE", "WOL", "LUT", "WAT"])("puts dark text on %s", (code) => {
    expect(teamTextColor(code)).toBe(ON_LIGHT_SHIRT);
  });

  it.each(["LIV", "ARS", "TOT", "CHE", "MUN", "NEW", "FUL"])("keeps white on %s", (code) => {
    expect(teamTextColor(code)).toBe(ON_DARK_SHIRT);
  });

  it("never picks the worse of the two", () => {
    for (const code of ["ARS", "AVL", "BOU", "BRE", "BHA", "BUR", "CHE", "CRY", "EVE", "FUL",
      "LEE", "LIV", "MCI", "MUN", "NEW", "NFO", "SUN", "TOT", "WHU", "WOL", "XYZ"]) {
      const shirt = teamColor(code);
      const chosen = contrastRatio(teamTextColor(code), shirt);
      const other = contrastRatio(teamTextColor(code) === ON_DARK_SHIRT ? ON_LIGHT_SHIRT : ON_DARK_SHIRT, shirt);
      expect(chosen, code).toBeGreaterThanOrEqual(other);
      // The weakest known pairing is Sunderland's red under white, 4.48:1;
      // anything under 3 would mean a shirt colour that neither works on.
      expect(chosen, code).toBeGreaterThanOrEqual(3);
    }
  });

  it("agrees with the worked WCAG values", () => {
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 5);
    expect(contrastRatio("#ffffff", "#6CABDD")).toBeCloseTo(2.47, 2);
    expect(contrastText("#000000")).toBe(ON_DARK_SHIRT);
    expect(contrastText("#ffffff")).toBe(ON_LIGHT_SHIRT);
  });
});
