"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { positionLabel, type PlayerOption, type TeamOption } from "@/lib/players";
import { foldDiacritics, isPlayerAvailable } from "@/lib/rules";
import { kickoffLabel, type GameweekFixture } from "@/lib/fixtures";
import { relativeTime } from "@/lib/relativeTime";
import { STATUS_LABEL } from "../PlayerSearchInput";
import { TeamBadge } from "../TeamBadge";

const NAME_RESULT_LIMIT = 24;

/** Why this player can't be picked, or null if they can. Mirrors the
 * database's picks_guard trigger — the trigger is the enforcement, this is
 * only what lets the screen say so before a save fails. */
export function usedReason(
  code: number,
  usedCounts: Map<number, number>,
  nominationCode: number | null,
): string | null {
  if (isPlayerAvailable(code, usedCounts, nominationCode)) return null;
  return code === nominationCode ? "Nomination, both uses gone" : "Already used this season";
}

function usedWhen(usedGameweeks: Map<number, number[]>, code: number): string {
  const gws = usedGameweeks.get(code);
  if (!gws || gws.length === 0) return "";
  return `GW${gws.join(", GW")}`;
}

/** "4 goals · 2 assists · 8 starts", or an honest blank when the stats
 * haven't been synced. A confident 0 for a number we don't actually have is
 * the spreadsheet problem in a new hat. */
function statLine(player: PlayerOption): string | null {
  if (player.goals === null && player.assists === null && player.starts === null) return null;
  const part = (value: number | null, singular: string) =>
    value === null ? `— ${singular}s` : `${value} ${value === 1 ? singular : `${singular}s`}`;
  return [part(player.goals, "goal"), part(player.assists, "assist"), part(player.starts, "start")]
    .join(" · ");
}

function fixtureFor(fixtures: GameweekFixture[], teamId: number) {
  const f = fixtures.find((fx) => fx.team_h === teamId || fx.team_a === teamId);
  if (!f) return null;
  return { match: `${f.home} v ${f.away}`, when: kickoffLabel(f.kickoff_time) };
}

/** Goals first, then starts, then name. For "who might score for Arsenal
 * this weekend" that ordering is the question itself; ties fall back to
 * something stable so the list doesn't reshuffle between renders. */
function byGoalThreat(a: PlayerOption, b: PlayerOption) {
  return (
    (b.goals ?? -1) - (a.goals ?? -1) ||
    (b.starts ?? -1) - (a.starts ?? -1) ||
    a.web_name.localeCompare(b.web_name)
  );
}

export function PlayerBrowser({
  players,
  teams,
  fixtures,
  usedCounts,
  usedGameweeks,
  nominationCode,
  syncedAt,
  onSelect,
  onCancel,
}: {
  players: PlayerOption[];
  teams: TeamOption[];
  fixtures: GameweekFixture[];
  usedCounts: Map<number, number>;
  usedGameweeks: Map<number, number[]>;
  nominationCode: number | null;
  syncedAt: string | null;
  onSelect: (player: PlayerOption) => void;
  /** Null when there's nothing to go back to — i.e. no pick made yet. */
  onCancel: (() => void) | null;
}) {
  const [query, setQuery] = useState("");
  const [teamId, setTeamId] = useState<number | null>(null);
  const [activeRaw, setActive] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const needle = foldDiacritics(query.trim());
  const selectedTeam = teamId ? teams.find((t) => t.id === teamId) ?? null : null;

  // Clubs whose name matches what's been typed, so "arsenal" offers the club
  // as well as anyone whose name happens to contain it.
  const teamMatches = useMemo(() => {
    if (needle.length === 0 || teamId !== null) return [];
    return teams
      .filter((t) => foldDiacritics(`${t.name} ${t.short_name}`).includes(needle))
      .slice(0, 4);
  }, [needle, teams, teamId]);

  const playerMatches = useMemo(() => {
    const pool = teamId === null ? players : players.filter((p) => p.team_id === teamId);
    if (needle.length === 0) {
      // No text, no club: nothing to list. Rendering all 600 players here
      // would bury the club chips under a scroll bar.
      return teamId === null ? [] : [...pool].sort(byGoalThreat);
    }
    const matched = pool.filter((p) =>
      foldDiacritics(`${p.full_name} ${p.web_name} ${p.team_name} ${p.team_short_name}`).includes(needle),
    );
    // A typed name is a search, so the closest match goes first; within a
    // club it's a browse, so goals lead.
    if (teamId !== null) return matched.sort(byGoalThreat);
    return matched
      .sort((a, b) => {
        const aStarts = foldDiacritics(a.web_name).startsWith(needle) ? 0 : 1;
        const bStarts = foldDiacritics(b.web_name).startsWith(needle) ? 0 : 1;
        return aStarts - bStarts || byGoalThreat(a, b);
      })
      .slice(0, NAME_RESULT_LIMIT);
  }, [needle, players, teamId]);

  // One flat list of what's on screen, so the arrow keys can walk clubs and
  // players without caring which is which.
  const options = useMemo(
    () => [
      ...teamMatches.map((t) => ({ kind: "team" as const, team: t })),
      ...playerMatches.map((p) => ({ kind: "player" as const, player: p })),
    ],
    [teamMatches, playerMatches],
  );

  // Kept in range during render rather than reset from an effect: the list
  // can shrink under the cursor as you type, and an effect would leave one
  // frame pointing at an option that is no longer there.
  const active = activeRaw < options.length ? activeRaw : -1;

  useEffect(() => {
    if (active < 0) return;
    listRef.current
      ?.querySelector(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function search(value: string) {
    setQuery(value);
    setActive(-1);
  }

  function chooseTeam(id: number | null) {
    setTeamId(id);
    setQuery("");
    setActive(-1);
    inputRef.current?.focus();
  }

  function commit(index: number) {
    const option = options[index];
    if (!option) return;
    if (option.kind === "team") {
      chooseTeam(option.team.id);
      return;
    }
    if (usedReason(option.player.code, usedCounts, nominationCode)) return;
    onSelect(option.player);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (options.length === 0) return;
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((i) => (i + step + options.length) % options.length);
      return;
    }
    if (e.key === "Enter") {
      if (active >= 0) {
        e.preventDefault();
        commit(active);
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      // Escape backs out one layer at a time rather than throwing away the
      // club and the search in one go.
      if (query) search("");
      else if (teamId !== null) chooseTeam(null);
      else onCancel?.();
    }
  }

  const teamFixture = selectedTeam ? fixtureFor(fixtures, selectedTeam.id) : null;
  const nothingYet = needle.length === 0 && teamId === null;
  const noMatches = !nothingYet && options.length === 0;

  return (
    <div className="wb-picker" onKeyDown={onKeyDown}>
      <div className="wb-picker-search">
        <span className="wb-picker-search-icon" aria-hidden="true">
          &#9906;
        </span>
        <input
          ref={inputRef}
          id="wb-player-search"
          className="input wb-picker-input"
          type="search"
          role="combobox"
          autoComplete="off"
          aria-expanded={options.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          placeholder={selectedTeam ? `Search ${selectedTeam.name}` : "Search player or team"}
          aria-label="Search player or team"
          value={query}
          onChange={(e) => search(e.target.value)}
        />
        {onCancel && (
          <button type="button" className="btn btn-ghost wb-tap wb-picker-cancel" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>

      <div className="wb-chips" role="group" aria-label="Browse a club">
        {selectedTeam && (
          <button
            type="button"
            className="wb-chip wb-chip-clear wb-tap"
            onClick={() => chooseTeam(null)}
          >
            &#10005; All clubs
          </button>
        )}
        {teams.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`wb-chip wb-tap${t.id === teamId ? " wb-chip-on" : ""}`}
            aria-pressed={t.id === teamId}
            onClick={() => chooseTeam(t.id === teamId ? null : t.id)}
          >
            <TeamBadge code={t.code} size={18} />
            <span>{t.name}</span>
          </button>
        ))}
      </div>

      <div className="wb-picker-meta">
        {selectedTeam && (
          <span className="wb-picker-fixture">
            {teamFixture
              ? `${teamFixture.match} · ${teamFixture.when}`
              : `${selectedTeam.name} · no fixture this gameweek`}
          </span>
        )}
        {syncedAt && (
          <span
            className="wb-picker-synced"
            title={new Date(syncedAt).toLocaleString("en-GB", { timeZone: "Europe/London" })}
          >
            Player data refreshed {relativeTime(syncedAt)}
          </span>
        )}
      </div>

      <div className="wb-picker-results" ref={listRef} id={listId} role="listbox" aria-label="Results">
        {options.map((option, i) =>
          option.kind === "team" ? (
            <button
              key={`team-${option.team.id}`}
              type="button"
              role="option"
              id={`${listId}-${i}`}
              data-index={i}
              aria-selected={i === active}
              className={`wb-team-row wb-tap${i === active ? " wb-row-active" : ""}`}
              onMouseEnter={() => setActive(i)}
              onClick={() => chooseTeam(option.team.id)}
            >
              <TeamBadge code={option.team.code} size={26} />
              <span className="wb-team-row-name">{option.team.name}</span>
              <span className="wb-team-row-hint">Browse squad &rarr;</span>
            </button>
          ) : (
            <PlayerRow
              key={option.player.code}
              id={`${listId}-${i}`}
              index={i}
              activeIndex={active}
              player={option.player}
              reason={usedReason(option.player.code, usedCounts, nominationCode)}
              usedIn={usedWhen(usedGameweeks, option.player.code)}
              isNomination={option.player.code === nominationCode}
              onHover={() => setActive(i)}
              onSelect={() => onSelect(option.player)}
            />
          ),
        )}

        {nothingYet && (
          <p className="wb-picker-hint">
            Type a name, or tap a club to browse its squad. Anyone you&rsquo;ve already used stays
            on the list, locked, with the gameweek you spent them in. Your nomination is the
            exception — you get them twice.
          </p>
        )}
        {noMatches && (
          <p className="wb-picker-hint" role="status">
            {selectedTeam
              ? `Nobody in the ${selectedTeam.name} squad matches that. Spelling is on you.`
              : "No player or club by that name. Spelling is on you."}
          </p>
        )}
      </div>
    </div>
  );
}

function PlayerRow({
  id,
  index,
  activeIndex,
  player,
  reason,
  usedIn,
  isNomination,
  onHover,
  onSelect,
}: {
  id: string;
  index: number;
  activeIndex: number;
  player: PlayerOption;
  reason: string | null;
  usedIn: string;
  isNomination: boolean;
  onHover: () => void;
  onSelect: () => void;
}) {
  const stats = statLine(player);
  const unfit = player.status !== "a";

  return (
    <button
      type="button"
      role="option"
      id={id}
      data-index={index}
      aria-selected={index === activeIndex}
      disabled={!!reason}
      className={`wb-player-row${index === activeIndex ? " wb-row-active" : ""}${reason ? " wb-player-row-locked" : ""}`}
      onMouseEnter={onHover}
      onClick={onSelect}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- server-posterised card */}
      <img className="wb-player-photo" src={`/api/player-image/${player.code}`} alt="" />

      <span className="wb-player-detail">
        <span className="wb-player-name">
          {player.web_name}
          {isNomination && <span className="wb-flag wb-flag-nom">Nomination</span>}
          {/* Only ever shown for a player who is *not* available — a "fit"
              badge on the other 580 would be noise, and the absence of a
              warning is the normal case. */}
          {unfit && (
            <span className="wb-flag wb-flag-warn">
              <span aria-hidden="true">&#9888;</span>
              {STATUS_LABEL[player.status] ?? player.status}
            </span>
          )}
        </span>
        <span className="wb-player-club">
          <TeamBadge code={player.team_code} size={14} />
          {player.team_name} &middot; {positionLabel(player.element_type)}
        </span>
        <span className="wb-player-stats">
          {stats ?? "Season stats not synced yet"}
        </span>
        {unfit && player.news && <span className="wb-player-news">{player.news}</span>}
      </span>

      {reason && (
        // Text and a padlock, not a colour: the locked state has to survive
        // greyscale and a colour-blind reader.
        <span className="wb-player-locked-flag">
          <span aria-hidden="true">&#128274;</span>
          <span>{usedIn || "Used"}</span>
          <span className="sr-only">{reason}</span>
        </span>
      )}
    </button>
  );
}
