"use client";

import { useMemo, useState, useTransition } from "react";
import type { PlayerOption } from "@/lib/players";
import { foldDiacritics, isPlayerAvailable } from "@/lib/rules";
import type { GameweekFixture } from "@/lib/fixtures";
import type { Stake } from "@/lib/supabase/types";
import { STATUS_LABEL } from "../PlayerSearchInput";
import { TeamBadge } from "../TeamBadge";
import { submitPick } from "./actions";

function fixtureFor(fixtures: GameweekFixture[], teamId: number) {
  const f = fixtures.find((fx) => fx.team_h === teamId || fx.team_a === teamId);
  if (!f) return null;
  return {
    match: `${f.home} v ${f.away}`,
    when: f.kickoff_time
      ? new Date(f.kickoff_time).toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" })
      : "TBC",
  };
}

function usedReason(code: number, usedCounts: Map<number, number>, nominationCode: number | null): string | null {
  if (isPlayerAvailable(code, usedCounts, nominationCode)) return null;
  return code === nominationCode ? "Nomination, both uses gone" : "Already used this season";
}

export function PickForm({
  gameweek,
  players,
  fixtures,
  usedCounts,
  nominationCode,
  doublesUsedCount,
  currentPick,
}: {
  gameweek: number;
  players: PlayerOption[];
  fixtures: GameweekFixture[];
  usedCounts: Map<number, number>;
  nominationCode: number | null;
  doublesUsedCount: number;
  currentPick: { player_code: number; stake: Stake } | null;
}) {
  const [query, setQuery] = useState("");
  const [selectedCode, setSelectedCode] = useState<number | null>(currentPick?.player_code ?? null);
  const [stake, setStake] = useState<Stake>(currentPick?.stake ?? 3);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const results = useMemo(() => {
    const q = foldDiacritics(query.trim());
    if (q.length === 0) return [];
    return players
      .filter((p) => foldDiacritics(`${p.full_name} ${p.web_name} ${p.team_short_name}`).includes(q))
      .slice(0, 12);
  }, [query, players]);

  const selected = selectedCode ? players.find((p) => p.code === selectedCode) ?? null : null;
  const burned = selected ? usedReason(selected.code, usedCounts, nominationCode) : null;
  const status = selected && selected.status !== "a" ? selected : null;
  const fixture = selected ? fixtureFor(fixtures, selected.team_id) : null;
  const thirdDouble = stake === 6 && doublesUsedCount >= 2;

  function pick(player: PlayerOption) {
    setSelectedCode(player.code);
    setSaved(false);
    setError(null);
  }

  function save() {
    if (!selected || burned) return;
    setError(null);
    startTransition(async () => {
      const result = await submitPick(gameweek, selected.code, stake);
      if (!result.ok) {
        setError(result.error ?? "Could not save.");
        return;
      }
      setSaved(true);
    });
  }

  return (
    <div className="wb-pickform">
      <div className="wb-pickform-grid">
      <section className="wb-pickform-col-left">
        <div className="field" style={{ maxWidth: 420 }}>
          <label htmlFor="wb-q">Search 600-odd players — accents optional</label>
          <input
            id="wb-q"
            className="input"
            type="text"
            placeholder="gyokeres"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSaved(false);
            }}
          />
        </div>
        <div style={{ marginTop: 16, borderTop: "1px solid var(--color-divider)" }}>
          {results.map((r) => {
            const reason = usedReason(r.code, usedCounts, nominationCode);
            const st = r.status !== "a" ? r : null;
            const note = reason ?? (st ? `${STATUS_LABEL[st.status] ?? st.status}` : "");
            return (
              <button
                key={r.code}
                type="button"
                onClick={() => (reason ? undefined : pick(r))}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  width: "100%",
                  padding: "11px 8px 11px 0",
                  background: "none",
                  border: 0,
                  borderBottom: "1px solid var(--color-divider)",
                  textAlign: "left",
                  fontFamily: "var(--font-body)",
                  color: "var(--color-text)",
                  cursor: reason ? "not-allowed" : "pointer",
                  opacity: reason ? 0.45 : 1,
                }}
              >
                {r.team_code ? (
                  <TeamBadge code={r.team_code} />
                ) : (
                  <span style={{ width: 10, height: 10, flex: "none", background: "var(--color-neutral-500)" }} />
                )}
                <span style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 15 }}>{r.web_name}</span>
                <span style={{ fontSize: 12, color: "color-mix(in srgb, var(--color-text) 55%, transparent)" }}>
                  {r.team_short_name}
                </span>
                {note && (
                  <span
                    style={{
                      marginLeft: "auto",
                      fontSize: 11,
                      textAlign: "right",
                      color: reason
                        ? "color-mix(in srgb, var(--color-text) 40%, transparent)"
                        : "var(--color-accent-700)",
                    }}
                  >
                    {note}
                  </span>
                )}
              </button>
            );
          })}
          {query.trim().length > 0 && results.length === 0 && (
            <p style={{ margin: "14px 0 0", fontSize: 13, color: "color-mix(in srgb, var(--color-text) 55%, transparent)" }}>
              Nobody by that name. Spelling is on you.
            </p>
          )}
        </div>
      </section>

      <section className="wb-pickform-col-right">
        {selected ? (
          <div>
            <div style={{ display: "flex", gap: 16, alignItems: "stretch" }}>
              <div style={{ width: 96, height: 126, flex: "none" }}>
                {/* eslint-disable-next-line @next/next/no-img-element -- server-posterised card */}
                <img
                  src={`/api/player-image/${selected.code}`}
                  alt={selected.web_name}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 34, lineHeight: 1.05, letterSpacing: "-.02em" }}>
                  {selected.web_name}
                </p>
                <p
                  style={{
                    margin: "2px 0 0",
                    fontSize: 13,
                    color: "color-mix(in srgb, var(--color-text) 60%, transparent)",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <TeamBadge code={selected.team_code} />
                  {selected.team_short_name}
                  {fixture ? ` · ${fixture.match} · ${fixture.when}` : " · no fixture this week"}
                </p>
                {(burned || status) && (
                  <p
                    style={{
                      margin: "10px 0 0",
                      background: "var(--color-accent-100)",
                      color: "var(--color-accent-800)",
                      fontSize: 12,
                      padding: "8px 10px",
                      borderLeft: "3px solid var(--color-accent)",
                    }}
                  >
                    {burned
                      ? `${burned} — and no hat-trick since, so the database will refuse this one.`
                      : `${STATUS_LABEL[status!.status] ?? status!.status}${status!.news ? `: ${status!.news}` : "."}`}
                  </p>
                )}
              </div>
            </div>

            <div style={{ marginTop: 20, borderTop: "2px solid var(--color-divider)", paddingTop: 16, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", color: "color-mix(in srgb, var(--color-text) 55%, transparent)" }}>
                Stake
              </span>
              <div style={{ display: "flex", border: "1px solid var(--color-divider)" }}>
                <button
                  type="button"
                  onClick={() => {
                    setStake(3);
                    setSaved(false);
                  }}
                  style={{
                    padding: "8px 18px",
                    border: 0,
                    cursor: "pointer",
                    fontFamily: "var(--font-heading)",
                    fontWeight: 800,
                    fontSize: 13,
                    background: stake === 3 ? "var(--color-text)" : "transparent",
                    color: stake === 3 ? "var(--color-bg)" : "var(--color-text)",
                  }}
                >
                  £3
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStake(6);
                    setSaved(false);
                  }}
                  style={{
                    padding: "8px 18px",
                    border: 0,
                    borderLeft: "1px solid var(--color-divider)",
                    cursor: "pointer",
                    fontFamily: "var(--font-heading)",
                    fontWeight: 800,
                    fontSize: 13,
                    background: stake === 6 ? "var(--color-accent)" : "transparent",
                    color: stake === 6 ? "var(--color-bg)" : "var(--color-text)",
                  }}
                >
                  £6 · double
                </button>
              </div>
              <span style={{ fontSize: 12, color: "color-mix(in srgb, var(--color-text) 55%, transparent)" }}>
                {stake === 6
                  ? thirdDouble
                    ? "Both free doubles spent — a blank costs you −2."
                    : `${Math.max(0, 2 - doublesUsedCount)} free double${2 - doublesUsedCount === 1 ? "" : "s"} left this season.`
                  : "Goals score once. Safe, unremarkable."}
              </span>
            </div>

            <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 12 }}>
              <button
                type="button"
                className="btn btn-primary wb-tap"
                onClick={save}
                disabled={isPending || !!burned}
              >
                {isPending ? "Saving…" : saved ? "Saved" : burned ? "Not allowed" : "Save pick"}
              </button>
              <span style={{ fontSize: 12, color: "color-mix(in srgb, var(--color-text) 60%, transparent)" }}>
                {error
                  ? error
                  : saved
                    ? "Everyone can see it already. That's the deal."
                    : "Editable until the deadline, then the database stops listening."}
              </span>
            </div>
          </div>
        ) : (
          <div style={{ border: "2px dashed var(--color-divider)", padding: "40px 24px" }}>
            <p style={{ margin: 0, fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 24, lineHeight: 1.15 }}>
              Type a name.
            </p>
            <p style={{ margin: "8px 0 0", fontSize: 13, color: "color-mix(in srgb, var(--color-text) 60%, transparent)" }}>
              Anyone you&rsquo;ve already used this season shows up greyed, with the reason. Your nomination is
              the exception — you get them twice.
            </p>
          </div>
        )}
      </section>
      </div>
    </div>
  );
}
