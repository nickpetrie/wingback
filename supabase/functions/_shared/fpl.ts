// The only place in this codebase that talks to the FPL API. It has no CORS
// headers, so every call must be server-side (an edge function, never the
// browser). bootstrap-static is ~5MB but is one request for everything —
// no batching, no pagination.
const BASE = "https://fantasy.premierleague.com/api";

export interface FplTeam {
  id: number;
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

// FPL's edge (Incapsula/Cloudflare-ish) blocks requests that don't look
// like a browser: a bare Deno `fetch()` with no User-Agent gets a flat 403,
// even on endpoints that otherwise work fine (seen in practice: /fixtures/
// blocked while /bootstrap-static/ in the same run succeeded). A retry is
// also worth it here — this call only gets an hourly cron shot at success,
// so a single transient block shouldn't cost a full hour of staleness.
const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "application/json",
};

async function getJson<T>(path: string, attempt = 1): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: BROWSER_HEADERS });
  if (!res.ok) {
    if ((res.status === 403 || res.status === 429 || res.status >= 500) && attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
      return getJson<T>(path, attempt + 1);
    }
    throw new Error(`FPL API ${path} responded ${res.status}`);
  }
  return res.json() as Promise<T>;
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
