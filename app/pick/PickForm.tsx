"use client";

import { useMemo, useState, useTransition } from "react";
import type { PlayerOption } from "@/lib/players";
import { foldDiacritics, isPlayerAvailable } from "@/lib/rules";
import { submitPick } from "./actions";

const STATUS_LABEL: Record<string, string> = {
  a: "Available",
  d: "Doubtful",
  i: "Injured",
  s: "Suspended",
  u: "Unavailable",
  n: "Not in squad",
};

export function PickForm({
  gameweek,
  players,
  usedCounts,
  nominationCode,
  doublesUsedCount,
  currentPick,
}: {
  gameweek: number;
  players: PlayerOption[];
  usedCounts: Map<number, number>;
  nominationCode: number | null;
  doublesUsedCount: number;
  currentPick: { player_code: number; stake: 3 | 6 } | null;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<PlayerOption | null>(
    currentPick ? players.find((p) => p.code === currentPick.player_code) ?? null : null,
  );
  const [stake, setStake] = useState<3 | 6>(currentPick?.stake ?? 3);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const matches = useMemo(() => {
    const needle = foldDiacritics(query.trim());
    if (needle.length === 0) return [];
    return players
      .filter((p) => foldDiacritics(`${p.full_name} ${p.web_name} ${p.team_short_name}`).includes(needle))
      .slice(0, 20);
  }, [query, players]);

  const usedWarning = selected && !isPlayerAvailable(selected.code, usedCounts, nominationCode);
  const thirdDoubleWarning = stake === 6 && doublesUsedCount >= 2;

  function pick(player: PlayerOption) {
    setSelected(player);
    setQuery("");
  }

  function submit() {
    if (!selected) return;
    setMessage(null);
    startTransition(async () => {
      const result = await submitPick(gameweek, selected.code, stake);
      setMessage(result.ok ? "Pick saved." : `Could not save: ${result.error}`);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <input
          type="text"
          placeholder="Search players…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
        />
        {matches.length > 0 && (
          <ul className="absolute z-10 mt-1 max-h-72 w-full overflow-auto rounded-md border border-neutral-200 bg-white shadow-lg">
            {matches.map((p) => (
              <li key={p.code}>
                <button
                  type="button"
                  onClick={() => pick(p)}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-neutral-100"
                >
                  <span>
                    {p.web_name} <span className="text-neutral-400">· {p.team_short_name}</span>
                  </span>
                  {p.status !== "a" && (
                    <span className="text-xs text-amber-600">{STATUS_LABEL[p.status] ?? p.status}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {selected && (
        <div className="rounded-md border border-neutral-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{selected.web_name}</p>
              <p className="text-sm text-neutral-500">{selected.team_short_name}</p>
            </div>
            {selected.status !== "a" && (
              <span className="rounded bg-amber-100 px-2 py-1 text-xs text-amber-800">
                {STATUS_LABEL[selected.status] ?? selected.status}
                {selected.news ? `: ${selected.news}` : ""}
              </span>
            )}
          </div>

          <div className="mt-4 flex items-center gap-3">
            <span className="text-sm text-neutral-500">Stake</span>
            <button
              type="button"
              onClick={() => setStake(3)}
              className={`rounded-md px-3 py-1 text-sm ${stake === 3 ? "bg-neutral-900 text-white" : "bg-neutral-100"}`}
            >
              £3
            </button>
            <button
              type="button"
              onClick={() => setStake(6)}
              className={`rounded-md px-3 py-1 text-sm ${stake === 6 ? "bg-neutral-900 text-white" : "bg-neutral-100"}`}
            >
              £6 (double)
            </button>
          </div>

          {usedWarning && (
            <p className="mt-3 text-sm text-amber-700">
              You&rsquo;ve already used this player up{selected.code === nominationCode ? " (twice)" : ""} this
              season — the pick will be rejected unless they&rsquo;ve since scored a hat-trick for you.
            </p>
          )}
          {thirdDoubleWarning && (
            <p className="mt-3 text-sm text-amber-700">
              This is double #{doublesUsedCount + 1} — your two free doubles are used, so a blank costs
              −2 points per goalless fixture.
            </p>
          )}

          <button
            type="button"
            onClick={submit}
            disabled={isPending}
            className="mt-4 w-full rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {isPending ? "Saving…" : "Save pick"}
          </button>
          {message && <p className="mt-2 text-sm">{message}</p>}
        </div>
      )}
    </div>
  );
}
