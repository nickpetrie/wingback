import { describe, expect, it } from "vitest";
import { getCurrentGameweek } from "./gameweek";

/** The thinnest thing that behaves like the one query getCurrentGameweek
 * makes. Hand-rolled rather than mocked with a library: the chain is five
 * calls long and a stub that returns itself is easier to read — and harder to
 * quietly diverge from — than a mock framework's expectations. */
function fakeClient(row: { id: number; lock_at: string | null } | null) {
  const chain = {
    select: () => chain,
    eq: () => chain,
    order: () => chain,
    limit: () => chain,
    maybeSingle: async () => ({ data: row, error: null }),
  };
  return { from: () => chain } as never;
}

const inAnHour = () => new Date(Date.now() + 60 * 60 * 1000).toISOString();
const anHourAgo = () => new Date(Date.now() - 60 * 60 * 1000).toISOString();

describe("getCurrentGameweek", () => {
  it("is open while the lock is still ahead", async () => {
    const gw = await getCurrentGameweek(fakeClient({ id: 3, lock_at: inAnHour() }));
    expect(gw).toMatchObject({ id: 3, state: "open" });
  });

  it("stays on the gameweek being played once its lock has passed", async () => {
    // The regression this exists for: the app used to look for the earliest
    // gameweek still *open for picks*, so a minute after the deadline it
    // jumped to next week while ten matches were still to be played.
    const gw = await getCurrentGameweek(fakeClient({ id: 2, lock_at: anHourAgo() }));
    expect(gw).toMatchObject({ id: 2, state: "locked" });
  });

  it("is unscheduled when FPL hasn't confirmed fixture times", async () => {
    const gw = await getCurrentGameweek(fakeClient({ id: 7, lock_at: null }));
    expect(gw).toMatchObject({ id: 7, state: "unscheduled" });
  });

  it("is null when there is no gameweek data at all", async () => {
    expect(await getCurrentGameweek(fakeClient(null))).toBeNull();
  });
});
