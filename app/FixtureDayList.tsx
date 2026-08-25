import { groupFixturesByDay, kickoffTimeLabel, type GameweekFixture } from "@/lib/fixtures";
import type { GameweekPick } from "@/lib/picks";
import { teamColor } from "@/lib/teamColors";
import { TeamBadge } from "./TeamBadge";

const MUTED = "color-mix(in srgb, var(--color-text) 55%, transparent)";

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "es"}`;
}

export function FixtureDayList({
  fixtures,
  picks,
}: {
  fixtures: GameweekFixture[];
  picks: GameweekPick[];
}) {
  const days = groupFixturesByDay(fixtures);

  return (
    <div className="wb-fixture-days">
      {days.map((day) => {
        const picksToday = picks.filter((p) =>
          day.fixtures.some((f) => f.team_h === p.team_id || f.team_a === p.team_id),
        );
        // A day everyone has already watched is worth collapsing by default;
        // the one still to come is the one you're here for.
        const allPlayed = day.fixtures.every((f) => f.played);

        return (
          <details key={day.key} className="wb-fixture-day" open={!allPlayed}>
            <summary className="wb-fixture-day-head">
              <span className="wb-chev" aria-hidden="true">
                ▶
              </span>
              <span className="wb-fixture-day-label">{day.label}</span>
              <span style={{ fontSize: 11, color: MUTED }}>
                {plural(day.fixtures.length, "match")}
                {picksToday.length > 0 ? ` · ${picksToday.length} picked` : ""}
              </span>
            </summary>

            {day.fixtures.map((f) => {
              const chips = picks.filter((p) => p.team_id === f.team_h || p.team_id === f.team_a);
              return (
                <div key={f.id} className="wb-fixture-row">
                  <span
                    className="wb-fixture-time"
                    style={{ fontSize: 12, color: MUTED, fontVariantNumeric: "tabular-nums" }}
                  >
                    {f.played ? "FT" : kickoffTimeLabel(f.kickoff_time)}
                  </span>
                  <span className="wb-fixture-match">
                    <TeamBadge code={f.home_code} /> {f.home}
                    <span style={{ color: MUTED, fontWeight: 400 }}>v</span>
                    {f.away} <TeamBadge code={f.away_code} />
                  </span>
                  <span className="wb-fixture-chips">
                    {chips.map((p, i) => (
                      <span
                        key={i}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          fontSize: 11,
                          padding: "2px 7px",
                          background: teamColor(p.team_short_name),
                          color: "#fff",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {p.entrant_name.split(" ")[0]} · {p.player_name}
                        {p.stake === 6 ? " ×2" : ""}
                      </span>
                    ))}
                  </span>
                </div>
              );
            })}
          </details>
        );
      })}
    </div>
  );
}
