import type { createClient } from "@/lib/supabase/server";

export interface GameweekFixture {
  id: number;
  kickoff_time: string | null;
  played: boolean;
  started: boolean;
  team_h: number;
  team_a: number;
  home: string;
  away: string;
  home_code: number | null;
  away_code: number | null;
}

export async function getGameweekFixtures(
  supabase: Awaited<ReturnType<typeof createClient>>,
  gameweekId: number,
): Promise<GameweekFixture[]> {
  const { data } = await supabase
    .from("fixtures")
    .select(
      "id, kickoff_time, played, started, team_h, team_a, home:teams!fixtures_team_h_fkey(short_name, code), away:teams!fixtures_team_a_fkey(short_name, code)",
    )
    .eq("event", gameweekId)
    .order("kickoff_time", { ascending: true });

  return (data ?? []).map((f) => ({
    id: f.id,
    kickoff_time: f.kickoff_time,
    played: f.played,
    started: f.started,
    team_h: f.team_h,
    team_a: f.team_a,
    home: f.home?.short_name ?? "?",
    away: f.away?.short_name ?? "?",
    home_code: f.home?.code ?? null,
    away_code: f.away?.code ?? null,
  }));
}

/* Fixture times are pinned to UK time rather than the renderer's locale:
 * these pages are server-rendered (UTC on Vercel) but read in the UK, and a
 * 20:00 BST kickoff formatted as UTC lands an hour early — and, now that
 * fixtures are grouped by day, a late Sunday kickoff would file itself under
 * Monday. */
const UK_TZ = "Europe/London";

export function kickoffTimeLabel(iso: string | null): string {
  if (!iso) return "TBC";
  return new Date(iso).toLocaleTimeString("en-GB", {
    timeZone: UK_TZ,
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function kickoffLabel(iso: string | null): string {
  if (!iso) return "TBC";
  const day = new Date(iso).toLocaleDateString("en-GB", { timeZone: UK_TZ, weekday: "short" });
  return `${day} ${kickoffTimeLabel(iso)}`;
}

export interface FixtureDay {
  key: string;
  label: string;
  fixtures: GameweekFixture[];
}

/** Fixtures arrive ordered by kickoff (nulls last), so grouping in place
 * keeps the days — and the "date TBC" bucket — in the right order. */
export function groupFixturesByDay(fixtures: GameweekFixture[]): FixtureDay[] {
  const days = new Map<string, FixtureDay>();

  for (const f of fixtures) {
    const key = f.kickoff_time
      ? new Date(f.kickoff_time).toLocaleDateString("en-CA", { timeZone: UK_TZ })
      : "tbc";
    let day = days.get(key);
    if (!day) {
      day = {
        key,
        label: f.kickoff_time
          ? new Date(f.kickoff_time).toLocaleDateString("en-GB", {
              timeZone: UK_TZ,
              weekday: "long",
              day: "numeric",
              month: "short",
            })
          : "Date TBC",
        fixtures: [],
      };
      days.set(key, day);
    }
    day.fixtures.push(f);
  }

  return [...days.values()];
}
