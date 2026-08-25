"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { PlayerOption } from "@/lib/players";
import { foldDiacritics, isPlayerAvailable } from "@/lib/rules";
import { kickoffLabel, type GameweekFixture } from "@/lib/fixtures";
import type { Stake } from "@/lib/supabase/types";
import { STATUS_LABEL } from "../PlayerSearchInput";
import { TeamBadge } from "../TeamBadge";
import { submitPick } from "./actions";

const MUTED = "color-mix(in srgb, var(--color-text) 58%, transparent)";

function fixtureFor(fixtures: GameweekFixture[], teamId: number) {
  const f = fixtures.find((fx) => fx.team_h === teamId || fx.team_a === teamId);
  if (!f) return null;
  return { match: `${f.home} v ${f.away}`, when: kickoffLabel(f.kickoff_time) };
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
  const [savedPick, setSavedPick] = useState(currentPick);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // The search is a tool for changing your mind, not the resting state of the
  // screen: once there's a pick to look at, it stays out of the way.
  const [searching, setSearching] = useState(currentPick === null);
  const inputRef = useRef<HTMLInputElement>(null);
  const openedByUser = useRef(false);
  useEffect(() => {
    if (searching && openedByUser.current) inputRef.current?.focus();
  }, [searching]);

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
  const freeDoubles = Math.max(0, 2 - doublesUsedCount);
  const dirty =
    !savedPick || savedPick.player_code !== selectedCode || savedPick.stake !== stake;
  const hint =
    query.trim().length === 0
      ? "Anyone you've already used shows greyed, with the reason. Your nomination is the exception — you get them twice."
      : results.length === 0
        ? "Nobody by that name. Spelling is on you."
        : null;

  function openSearch() {
    openedByUser.current = true;
    setQuery("");
    setSearching(true);
  }

  function pick(player: PlayerOption) {
    setSelectedCode(player.code);
    setError(null);
    setQuery("");
    setSearching(false);
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
      setSavedPick({ player_code: selected.code, stake });
    });
  }

  return (
    <div className="wb-pickform">
      {searching ? (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input
              ref={inputRef}
              className="input"
              type="text"
              placeholder="Search players — accents optional"
              aria-label="Search players"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {selected && (
              <button type="button" className="btn btn-ghost wb-tap" style={{ flex: "none" }} onClick={() => setSearching(false)}>
                Cancel
              </button>
            )}
          </div>

          {results.length > 0 && (
            <div style={{ marginTop: 12 }}>
              {results.map((r) => {
                const reason = usedReason(r.code, usedCounts, nominationCode);
                const st = r.status !== "a" ? r : null;
                const note = reason ?? (st ? STATUS_LABEL[st.status] ?? st.status : "");
                return (
                  <button
                    key={r.code}
                    type="button"
                    onClick={() => pick(r)}
                    disabled={!!reason}
                    className="wb-result-row"
                    style={{ cursor: reason ? "not-allowed" : "pointer", opacity: reason ? 0.45 : 1 }}
                  >
                    {r.team_code ? (
                      <TeamBadge code={r.team_code} />
                    ) : (
                      <span style={{ width: 10, height: 10, flex: "none", background: "var(--color-neutral-500)" }} />
                    )}
                    <span style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 15 }}>{r.web_name}</span>
                    <span style={{ fontSize: 12, color: MUTED }}>{r.team_short_name}</span>
                    {note && (
                      <span
                        style={{
                          marginLeft: "auto",
                          paddingLeft: 8,
                          fontSize: 11,
                          textAlign: "right",
                          color: reason ? "color-mix(in srgb, var(--color-text) 40%, transparent)" : "var(--color-accent-700)",
                        }}
                      >
                        {note}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {hint && (
            <p style={{ margin: "12px 0 0", fontSize: 12, color: MUTED }}>
              {hint}
            </p>
          )}
        </div>
      ) : null}

      {selected && !searching && (
        <div className="wb-pick-card">
          <div style={{ width: 84, height: 110, flex: "none" }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- server-posterised card */}
            <img
              src={`/api/player-image/${selected.code}`}
              alt={selected.web_name}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 30, lineHeight: 1.05, letterSpacing: "-.02em" }}>
              {selected.web_name}
            </p>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: MUTED, display: "flex", alignItems: "center", gap: 6 }}>
              <TeamBadge code={selected.team_code} />
              {fixture ? `${fixture.match} · ${fixture.when}` : `${selected.team_short_name} · no fixture this week`}
            </p>
            <button type="button" className="btn btn-secondary wb-tap" style={{ marginTop: 10, fontSize: 12, padding: "6px 12px" }} onClick={openSearch}>
              Change player
            </button>
          </div>
        </div>
      )}

      {selected && !searching && (burned || status) && (
        <p
          style={{
            margin: "14px 0 0",
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

      {selected && !searching && (
        <>
          <div className="wb-stake-row">
            <span style={{ fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", color: MUTED }}>Stake</span>
            <div style={{ display: "flex", border: "1px solid var(--color-divider)" }}>
              <button
                type="button"
                onClick={() => setStake(3)}
                className="wb-stake-btn"
                style={{
                  background: stake === 3 ? "var(--color-text)" : "transparent",
                  color: stake === 3 ? "var(--color-bg)" : "var(--color-text)",
                }}
              >
                £3
              </button>
              <button
                type="button"
                onClick={() => setStake(6)}
                className="wb-stake-btn"
                style={{
                  borderLeft: "1px solid var(--color-divider)",
                  background: stake === 6 ? "var(--color-accent)" : "transparent",
                  color: stake === 6 ? "var(--color-bg)" : "var(--color-text)",
                }}
              >
                £6 · double
              </button>
            </div>
            {/* £3 is the default and needs no explaining — only the double has
                a consequence worth a line. */}
            {stake === 6 && (
              <span style={{ fontSize: 12, color: freeDoubles === 0 ? "var(--color-accent-700)" : MUTED }}>
                {freeDoubles === 0
                  ? "Both free doubles spent — a blank costs you −2."
                  : `${freeDoubles} free double${freeDoubles === 1 ? "" : "s"} left this season.`}
              </span>
            )}
          </div>

          <div style={{ marginTop: 18 }}>
            <button type="button" className="btn btn-primary wb-tap" onClick={save} disabled={isPending || !!burned || !dirty}>
              {isPending ? "Saving…" : burned ? "Not allowed" : !dirty ? "Saved" : savedPick ? "Update pick" : "Save pick"}
            </button>
            <p style={{ margin: "8px 0 0", fontSize: 12, color: error ? "var(--color-accent-700)" : MUTED }}>
              {error
                ? error
                : dirty
                  ? "Editable until the deadline, then the database stops listening."
                  : "Everyone can see it already. That's the deal."}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
