"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { PlayerOption, TeamOption } from "@/lib/players";
import { kickoffLabel, type GameweekFixture } from "@/lib/fixtures";
import type { Stake } from "@/lib/supabase/types";
import { STATUS_LABEL } from "../PlayerSearchInput";
import { TeamBadge } from "../TeamBadge";
import { runAction } from "@/lib/actions";
import { describePickFailure, type PickFailure } from "@/lib/pick-errors";
import { PlayerBrowser, usedReason } from "./PlayerBrowser";
import { submitPick } from "./actions";

const MUTED = "color-mix(in srgb, var(--color-text) 58%, transparent)";

/** Two quick retries before giving up. A gateway blip is usually over inside a
 * second, and the alternative is telling someone their pick failed when one
 * more attempt would have landed it. */
const RETRIES = 2;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function fixtureFor(fixtures: GameweekFixture[], teamId: number) {
  const f = fixtures.find((fx) => fx.team_h === teamId || fx.team_a === teamId);
  if (!f) return null;
  return { match: `${f.home} v ${f.away}`, when: kickoffLabel(f.kickoff_time) };
}

export function PickForm({
  gameweek,
  players,
  teams,
  fixtures,
  usedCounts,
  usedGameweeks,
  nominationCode,
  doublesUsedCount,
  currentPick,
  playersSyncedAt,
}: {
  gameweek: number;
  players: PlayerOption[];
  teams: TeamOption[];
  fixtures: GameweekFixture[];
  usedCounts: Map<number, number>;
  usedGameweeks: Map<number, number[]>;
  nominationCode: number | null;
  doublesUsedCount: number;
  currentPick: { player_code: number; stake: Stake } | null;
  playersSyncedAt: string | null;
}) {
  const [selectedCode, setSelectedCode] = useState<number | null>(currentPick?.player_code ?? null);
  const [stake, setStake] = useState<Stake>(currentPick?.stake ?? 3);
  const [savedPick, setSavedPick] = useState(currentPick);
  const [failure, setFailure] = useState<PickFailure | null>(null);
  // Bumped by "Try again". The save effect is otherwise driven by `dirty`,
  // which a failure leaves true, so this is what re-runs it on demand.
  const [attempt, setAttempt] = useState(0);
  const [isPending, startTransition] = useTransition();

  // The search is a tool for changing your mind, not the resting state of the
  // screen: once there's a pick to look at, it stays out of the way.
  const [searching, setSearching] = useState(currentPick === null);
  const changeRef = useRef<HTMLButtonElement>(null);

  const selected = selectedCode ? players.find((p) => p.code === selectedCode) ?? null : null;
  const burned = selected ? usedReason(selected.code, usedCounts, nominationCode) : null;
  const status = selected && selected.status !== "a" ? selected : null;
  const fixture = selected ? fixtureFor(fixtures, selected.team_id) : null;
  const freeDoubles = Math.max(0, 2 - doublesUsedCount);
  const dirty =
    !savedPick || savedPick.player_code !== selectedCode || savedPick.stake !== stake;

  function pick(player: PlayerOption) {
    setSelectedCode(player.code);
    setFailure(null);
    // The picker collapses back to the pick card once a choice is made; the
    // card, not the search, is the resting state of this screen.
    setSearching(false);
    // Focus has to land somewhere deliberate or it falls back to <body> and a
    // keyboard user is dumped at the top of the page.
    requestAnimationFrame(() => changeRef.current?.focus());
  }

  // Autosave. A pick is one row with two fields and a hard deadline — making
  // someone tap Save to commit it is a way to lose a gameweek to a forgotten
  // tap. The debounce is for the stake toggle: tapping £3/£6 a few times in a
  // row shouldn't fire a write per tap.
  useEffect(() => {
    if (!selected || burned || !dirty) return;
    const code = selected.code;
    let cancelled = false;
    const timer = setTimeout(() => {
      setFailure(null);
      startTransition(async () => {
        for (let tryNumber = 0; tryNumber <= RETRIES; tryNumber++) {
          if (tryNumber > 0) await sleep(400 * tryNumber);

          const result = await runAction(() => submitPick(gameweek, code, stake));
          // The player or stake changed under us — that render owns the save
          // now, and finishing this one would write a pick nobody asked for.
          if (cancelled) return;

          if (result.ok) {
            setSavedPick({ player_code: code, stake });
            return;
          }

          const described = describePickFailure(result.error, gameweek);
          // Retrying is safe: submitPick resolves to one row per entrant per
          // gameweek, so a reply lost on the way back cannot become two picks.
          if (!described.transient || tryNumber === RETRIES) {
            setFailure(described);
            return;
          }
        }
      });
    }, 600);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [selected, burned, dirty, gameweek, stake, attempt]);

  return (
    <div className="wb-pickform">
      {searching && (
        <PlayerBrowser
          players={players}
          teams={teams}
          fixtures={fixtures}
          usedCounts={usedCounts}
          usedGameweeks={usedGameweeks}
          nominationCode={nominationCode}
          syncedAt={playersSyncedAt}
          onSelect={pick}
          onCancel={selected ? () => setSearching(false) : null}
        />
      )}

      {selected && !searching && (
        <div className={`wb-pick-card${failure ? " wb-pick-card--failed" : ""}`}>
          <div className="wb-pick-photo">
            {/* eslint-disable-next-line @next/next/no-img-element -- server-posterised card */}
            <img src={`/api/player-image/${selected.code}`} alt={selected.web_name} />
          </div>

          <div className="wb-pick-detail">
            <p className="wb-pick-name">
              <TeamBadge code={selected.team_code} size={20} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {selected.web_name}
              </span>
            </p>
            <p className="wb-pick-fixture">
              {fixture ? `${fixture.match} · ${fixture.when}` : `${selected.team_short_name} · no fixture this week`}
            </p>

            <div className="wb-pick-controls">
              <span className="wb-pick-label">Player</span>
              <span>
                <button
                  ref={changeRef}
                  type="button"
                  className="wb-control wb-tap"
                  onClick={() => setSearching(true)}
                >
                  Change
                </button>
              </span>

              <span className="wb-pick-label">Stake</span>
              <span className="wb-control-group" role="group" aria-label="Stake">
                <button
                  type="button"
                  className="wb-control wb-tap"
                  aria-pressed={stake === 3}
                  onClick={() => setStake(3)}
                  style={{
                    background: stake === 3 ? "var(--color-text)" : "transparent",
                    color: stake === 3 ? "var(--color-bg)" : "var(--color-text)",
                  }}
                >
                  £3
                </button>
                <button
                  type="button"
                  className="wb-control wb-tap"
                  aria-pressed={stake === 6}
                  onClick={() => setStake(6)}
                  style={{
                    background: stake === 6 ? "var(--color-accent)" : "transparent",
                    color: stake === 6 ? "var(--color-bg)" : "var(--color-text)",
                  }}
                >
                  £6
                </button>
              </span>

              <span
                className="wb-pick-status"
                aria-live="polite"
                style={{ color: failure ? "var(--color-closed)" : MUTED }}
              >
                {failure ? (
                  <strong>Not registered</strong>
                ) : burned ? (
                  "Not saved"
                ) : isPending || dirty ? (
                  "Saving\u2026"
                ) : (
                  <>
                    <span aria-hidden="true" style={{ color: "var(--color-accent)", fontSize: 13 }}>
                      &#10003;
                    </span>
                    Saved
                  </>
                )}
                {/* £3 is the default and needs no explaining — only the double
                    has a consequence worth mentioning. */}
                {!failure && stake === 6 && (
                  <span style={{ color: freeDoubles === 0 ? "var(--color-accent-700)" : "inherit" }}>
                    {freeDoubles === 0
                      ? "· both doubles spent, a blank costs −2"
                      : `· ${freeDoubles} free double${freeDoubles === 1 ? "" : "s"} left`}
                  </span>
                )}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Loud, and above everything else on the screen that isn't the card
          itself. The old failure state was one line of small text in the
          corner of the controls, which is how a 502 came to read as a saved
          pick. role="alert" so a screen reader is interrupted by it too. */}
      {selected && !searching && failure && (
        <div className="wb-pick-alarm" role="alert">
          <p className="wb-pick-alarm-head">Your pick has not been registered</p>
          <p className="wb-pick-alarm-body">{failure.message}</p>
          {failure.transient && (
            <button
              type="button"
              className="wb-control wb-tap wb-pick-alarm-retry"
              onClick={() => setAttempt((n) => n + 1)}
              disabled={isPending}
            >
              {isPending ? "Trying\u2026" : "Try again"}
            </button>
          )}
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

    </div>
  );
}
