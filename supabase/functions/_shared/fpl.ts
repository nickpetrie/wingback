// The only place in this codebase that talks to the FPL API. It has no CORS
// headers, so every call must be server-side (an edge function, never the
// browser). bootstrap-static is ~5MB but is one request for everything —
// no batching, no pagination.
const BASE = "https://fantasy.premierleague.com/api";

export interface FplTeam {
  id: number;
  code: number; // stable id used by the crest CDN (resources.premierleague.com)
  name: string;
  short_name: string;
}

export interface FplElement {
  id: number; // current-season id; only valid for hitting /live/ this season
  code: number; // stable across seasons; the real join key
  web_name: string;
  first_name: string;
  second_name: string;
  team: number;
  element_type: number;
  status: string;
  news: string;
  chance_of_playing_next_round: number | null;
  photo: string;
}

export interface FplEvent {
  id: number;
  deadline_time: string;
  finished: boolean;
}

export interface FplBootstrap {
  teams: FplTeam[];
  elements: FplElement[];
  events: FplEvent[];
}

export interface FplFixtureStat {
  identifier: string;
  a: { value: number; element: number }[];
  h: { value: number; element: number }[];
}

export interface FplFixture {
  id: number;
  event: number | null;
  team_h: number;
  team_a: number;
  kickoff_time: string | null;
  finished: boolean;
  stats: FplFixtureStat[];
}

export interface FplLiveElement {
  id: number;
  stats: { goals_scored: number };
}

export interface FplLive {
  elements: FplLiveElement[];
}

// FPL's edge sits in front of the whole /api/ surface and refuses a share of
// requests from datacenter IPs with a flat 403. Measured against this
// project's own edge-function logs, roughly 6 in 10 individual requests are
// refused, and it is neither endpoint-specific nor sticky: /bootstrap-static/,
// /fixtures/, /fixtures/?event=N and /event/N/live/ all fail some of the time
// and all succeed moments later. So the thing that actually gets the data
// through is not a cleverer disguise, it's retrying long enough to catch one
// of the attempts that lands.
//
// Header notes, in case this is revisited:
//   - No Origin. A browser does not send one on a same-origin GET, so sending
//     it was the one header here actively contradicting the browser story.
//   - No Accept-Encoding. Setting it by hand turns off the runtime's
//     automatic decompression and res.json() then chokes on raw gzip.
//   - The Sec-Fetch-*/sec-ch-ua set is best effort: they're forbidden header
//     names in the fetch spec, so the runtime may drop them. Kept because they
//     cost nothing and a Chrome User-Agent with no client hints at all is
//     itself a mismatch.
const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  Accept: "application/json",
  "Accept-Language": "en-GB,en;q=0.9",
  Referer: "https://fantasy.premierleague.com/",
  "sec-ch-ua": '"Chromium";v="140", "Not=A?Brand";v="24", "Google Chrome";v="140"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Windows"',
  "Sec-Fetch-Dest": "empty",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Site": "same-origin",
};

// The previous 3 attempts at 1s then 2s spent their whole budget inside ~3.5s,
// which is short enough that all three tended to be refused together. Backing
// off further (with jitter, so concurrent callers don't land in lockstep) is
// what makes each attempt an independent roll. The budget caps a single
// request so a whole `score` run stays inside the function's wall clock.
const MAX_ATTEMPTS = 5;
const RETRY_BUDGET_MS = 25_000;

function backoffMs(attempt: number): number {
  const base = 1500 * 2 ** (attempt - 1);
  return Math.round(base * (0.5 + Math.random() * 0.5));
}

async function getJson<T>(path: string): Promise<T> {
  const startedAt = Date.now();
  let lastError = new Error(`FPL API ${path} was never attempted`);

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let retryable = true;
    try {
      const res = await fetch(`${BASE}${path}`, { headers: BROWSER_HEADERS });
      if (res.ok) return (await res.json()) as T;
      // Nothing reads a non-ok body, and leaving it undrained holds the
      // connection open for the rest of the isolate's life.
      await res.body?.cancel();
      retryable = res.status === 403 || res.status === 429 || res.status >= 500;
      lastError = new Error(`FPL API ${path} responded ${res.status}`);
    } catch (err) {
      // A connection reset or TLS failure is the same transient refusal
      // wearing different clothes; it used to end the run without a retry.
      lastError = err instanceof Error ? err : new Error(String(err));
    }

    const elapsed = Date.now() - startedAt;
    if (!retryable || attempt === MAX_ATTEMPTS || elapsed >= RETRY_BUDGET_MS) break;
    const wait = Math.min(backoffMs(attempt), RETRY_BUDGET_MS - elapsed);
    await new Promise((resolve) => setTimeout(resolve, wait));
  }

  throw lastError;
}

export function fetchBootstrap(): Promise<FplBootstrap> {
  return getJson<FplBootstrap>("/bootstrap-static/");
}

export function fetchFixturesForEvent(event: number): Promise<FplFixture[]> {
  return getJson<FplFixture[]>(`/fixtures/?event=${event}`);
}

export function fetchAllFixtures(): Promise<FplFixture[]> {
  return getJson<FplFixture[]>("/fixtures/");
}

export function fetchLive(event: number): Promise<FplLive> {
  return getJson<FplLive>(`/event/${event}/live/`);
}
