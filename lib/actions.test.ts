import { describe, expect, it } from "vitest";
import { runAction, UNREACHABLE } from "./actions";

describe("runAction", () => {
  it("passes a result straight through", async () => {
    expect(await runAction(async () => ({ ok: true }))).toEqual({ ok: true });
    expect(await runAction(async () => ({ ok: false, error: "locked" }))).toEqual({
      ok: false,
      error: "locked",
    });
  });

  it("turns a throw into a failed result rather than an unhandled rejection", async () => {
    // The whole point. A rejected server action used to escape the transition,
    // leaving the screen showing a pick that was never written.
    expect(
      await runAction(async () => {
        throw new TypeError("fetch failed");
      }),
    ).toEqual({ ok: false, error: UNREACHABLE });
  });

  it("catches a synchronous throw too", async () => {
    expect(
      await runAction(() => {
        throw new Error("boom");
      }),
    ).toEqual({ ok: false, error: UNREACHABLE });
  });
});
