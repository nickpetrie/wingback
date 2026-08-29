import { describe, expect, it } from "vitest";
import { pointsFor } from "./points.mjs";

// Every case below was checked against pick_points() running in Postgres, not
// against my reading of it — the first draft of the backup script scored a
// forward's goal as 4 because it had invented an FPL-style table, and read
// perfectly plausibly while doing so.
describe("pointsFor", () => {
  it("scores a forward's goal at face value", () => {
    expect(pointsFor(4, 3, 1)).toBe(1);
  });

  it("doubles a defender's goal", () => {
    expect(pointsFor(2, 3, 1)).toBe(2);
  });

  it("does not double a goalkeeper, midfielder or forward", () => {
    expect(pointsFor(1, 3, 1)).toBe(1);
    expect(pointsFor(3, 3, 1)).toBe(1);
    expect(pointsFor(4, 3, 1)).toBe(1);
  });

  it("doubles again at the £6 stake", () => {
    expect(pointsFor(4, 6, 1)).toBe(2);
  });

  it("stacks both doubles for a defender at £6", () => {
    expect(pointsFor(2, 6, 2)).toBe(8);
  });

  it("scores a blank as nothing, whatever the stake", () => {
    expect(pointsFor(2, 6, 0)).toBe(0);
    expect(pointsFor(4, 3, 0)).toBe(0);
  });
});
