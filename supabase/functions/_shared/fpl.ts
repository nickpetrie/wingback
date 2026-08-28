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
  goals_scored: number;
  assists: number;
  starts: number;
  minutes: number;
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
  // FPL flips this at full time; `finished` waits for bonus points to be
  // confirmed and in practice may never flip at all. See 000015.
  finished_provisional: boolean;
  started: boolean;
  minutes: number;
  stats: FplFixtureStat[];
}

export interface FplLiveElement {
  id: number;
  stats: { goals_scored: number };
}

export interface FplLive {
  elements: FplLiveElement[];
}

// FPL sits behind Fastly, and Fastly refuses this project's edge-function
// egress IP in bursts. While a burst is on, *every* request from that IP is
// answered 403 in 1-4ms with an empty body and `server: Varnish` — the plain
// homepage HTML included, not just /api/ — so the refusal never reaches the
// origin at all. Between bursts a completely bare fetch with no headers
// whatsoever succeeds (`server: openresty`).
//
// That was measured from the edge runtime itself, not guessed: nine request
// shapes — bare, browser-like, honest-bot User-Agent, with and without
// Origin, with and without the cookies the homepage hands out — were all
// refused inside one burst, and all fine ninety seconds later. Headers are
// not the lever here; time is. Don't spend another round trying to look more
// like a browser.
//
// A burst outlasts any plausible per-request retry, which is why the budget
// below belongs to the whole invocation.
const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  Accept: "application/json",
  "Accept-Language": "en-GB,en;q=0.9",
  Referer: "https://fantasy.premierleague.com/",
};

// Because the refusal is IP-wide, once FPL is blocking this run every later
// call in it is blocked too — so a per-request budget would let one run spend
// N times the wall clock discovering the same thing. One deadline per
// invocation, sized to stay well inside the edge function's wall-clock limit,
// and a later call that finds it already spent fails fast.
const RUN_BUDGET_MS = 110_000;
const MAX_ATTEMPTS = 7;
const MAX_BACKOFF_MS = 40_000;

let deadline = 0;
let loggedConfig = false;

// Call once at the top of a handler, before any FPL fetch. Isolates are reused
// between invocations, so without this the second run would inherit the first
// run's spent deadline and give up immediately.
export function startFplBudget(): void {
  deadline = Date.now() + RUN_BUDGET_MS;
}

function backoffMs(attempt: number): number {
  const base = Math.min(MAX_BACKOFF_MS, 5000 * 2 ** (attempt - 1));
  return Math.round(base * (0.5 + Math.random() * 0.5));
}

// The Vercel deployment can reach FPL from an address Fastly is not refusing,
// so when it's configured we go through it and only fall back to hitting FPL
// from here if the proxy itself is unreachable. Unset both vars and the
// behaviour is exactly what it was: straight to FPL.
const PROXY_URL = Deno.env.get("FPL_PROXY_URL")?.replace(/\/$/, "");
const PROXY_SECRET = Deno.env.get("FPL_PROXY_SECRET");

interface Source {
  name: string;
  url: string;
  headers: Record<string, string>;
}

function sourcesFor(path: string): Source[] {
  const direct: Source = { name: "fpl", url: `${BASE}${path}`, headers: BROWSER_HEADERS };
  if (!PROXY_URL || !PROXY_SECRET) return [direct];
  // The proxy route has no trailing slash on its segments, so /fixtures/?event=2
  // becomes /fixtures?event=2 — otherwise Next redirects and we pay an extra hop.
  return [
    {
      name: "proxy",
      url: `${PROXY_URL}${path.replace(/\/(?=\?|$)/, "")}`,
      headers: { "x-wingback-proxy-key": PROXY_SECRET, Accept: "application/json" },
    },
    direct,
  ];
}

async function getJson<T>(path: string): Promise<T> {
  if (deadline === 0) startFplBudget();
  if (!loggedConfig) {
    loggedConfig = true;
    console.log(`FPL sources: ${sourcesFor(path).map((s) => s.name).join(" then ")}`);
  }
  let lastError = new Error(`FPL API ${path} was never attempted`);

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let retryable = true;

    // Each source is tried once per attempt before backing off, so a proxy
    // that is merely down costs one wasted request rather than the whole run.
    for (const source of sourcesFor(path)) {
      try {
        const res = await fetch(source.url, { headers: source.headers });
        if (res.ok) return (await res.json()) as T;
        // Nothing reads a non-ok body, and leaving it undrained holds the
        // connection open for the rest of the isolate's life. `server` is worth
        // keeping: "Varnish" means the Fastly edge refused us and the origin
        // never saw the request, which is the burst described above.
        await res.body?.cancel();
        retryable = res.status === 403 || res.status === 429 || res.status >= 500;
        const server = res.headers.get("x-fpl-upstream-server") ?? res.headers.get("server");
        lastError = new Error(
          `FPL API ${path} via ${source.name} responded ${res.status}` +
            (server ? ` (server: ${server})` : ""),
        );
      } catch (err) {
        // A connection reset or TLS failure is the same transient refusal
        // wearing different clothes; it used to end the run without a retry.
        lastError = err instanceof Error ? err : new Error(String(err));
      }
      // Per source, because lastError is overwritten by whichever source is
      // tried last: without this a proxy failure is invisible in the logs and
      // "via fpl" can't be told apart from "proxy never configured".
      console.warn(`FPL ${path} attempt ${attempt}: ${source.name} — ${lastError.message}`);
      if (!retryable) break;
    }

    const remaining = deadline - Date.now();
    if (!retryable || attempt === MAX_ATTEMPTS || remaining <= 0) break;
    await new Promise((resolve) => setTimeout(resolve, Math.min(backoffMs(attempt), remaining)));
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
