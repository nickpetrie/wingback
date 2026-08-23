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

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) {
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
