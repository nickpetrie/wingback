// Calling a server action without trusting it to resolve.
//
// A server action call is a network request. When it cannot be made, or its
// reply never comes back — a 502 from the gateway, a phone that slept mid-tap
// — the promise rejects. Every call site in this app awaited one bare inside a
// transition, so nothing caught the throw, nothing set an error, and the
// screen went on showing exactly what it had shown before.
//
// Measured on Casra's gameweek 4 pick: the card showed Palmer, looking picked,
// while no row existed. Nobody else saw the pick and no alert fired, and he
// only found out because he happened to look again.

/** The action never reached the server, or its reply never came back. */
export const UNREACHABLE = "wingback/unreachable";

/** Run a server action so a transport failure arrives as a failed result
 * rather than an unhandled rejection. Every caller already handles
 * `{ ok: false }`; almost none of them handled a throw. */
export async function runAction<T extends { ok: boolean; error?: string }>(
  run: () => Promise<T>,
): Promise<T | { ok: false; error: string }> {
  try {
    return await run();
  } catch {
    return { ok: false, error: UNREACHABLE };
  }
}
