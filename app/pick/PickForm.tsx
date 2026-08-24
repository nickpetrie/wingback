"use client";

import { useState, useTransition } from "react";
import type { PlayerOption } from "@/lib/players";
import { isPlayerAvailable } from "@/lib/rules";
import { PlayerSearchInput, STATUS_LABEL } from "../PlayerSearchInput";
import { submitPick } from "./actions";

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
  const [selected, setSelected] = useState<PlayerOption | null>(
    currentPick ? players.find((p) => p.code === currentPick.player_code) ?? null : null,
  );
  const [stake, setStake] = useState<3 | 6>(currentPick?.stake ?? 3);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const unavailable = selected && !isPlayerAvailable(selected.code, usedCounts, nominationCode);
  const thirdDoubleWarning = stake === 6 && doublesUsedCount >= 2;

  function submit() {
    if (!selected || unavailable) return;
    setMessage(null);
    startTransition(async () => {
      const result = await submitPick(gameweek, selected.code, stake);
      setMessage(result.ok ? "Pick saved." : `Could not save: ${result.error}`);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <PlayerSearchInput players={players} onSelect={setSelected} />

      {selected && (
        <div className="rounded-2xl border border-foreground/10 bg-surface p-5 shadow-sm backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-lg font-semibold text-foreground">{selected.web_name}</p>
              <p className="text-sm text-foreground/50">{selected.team_short_name}</p>
            </div>
            {selected.status !== "a" && (
              <span className="rounded-full bg-gold-500/15 px-2.5 py-1 text-xs font-medium text-gold-400">
                {STATUS_LABEL[selected.status] ?? selected.status}
                {selected.news ? `: ${selected.news}` : ""}
              </span>
            )}
          </div>

          <div className="mt-4 flex items-center gap-3">
            <span className="text-sm text-foreground/50">Stake</span>
            <button
              type="button"
              onClick={() => setStake(3)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                stake === 3 ? "bg-pitch-500 text-white" : "bg-black/20 text-foreground"
              }`}
            >
              £3
            </button>
            <button
              type="button"
              onClick={() => setStake(6)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                stake === 6 ? "bg-gold-500 text-pitch-900" : "bg-black/20 text-foreground"
              }`}
            >
              £6 (double)
            </button>
          </div>

          {unavailable && (
            <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">
              You&rsquo;ve already used this player up{selected.code === nominationCode ? " (twice)" : ""} this
              season, and they haven&rsquo;t scored a hat-trick since — pick someone else.
            </p>
          )}
          {!unavailable && thirdDoubleWarning && (
            <p className="mt-3 rounded-lg bg-gold-500/10 px-3 py-2 text-sm text-gold-400">
              This is double #{doublesUsedCount + 1} — your two free doubles are used, so a blank costs
              −2 points per goalless fixture.
            </p>
          )}

          <button
            type="button"
            onClick={submit}
            disabled={isPending || !!unavailable}
            className="mt-4 w-full rounded-full bg-gold-500 px-4 py-2.5 text-sm font-semibold text-pitch-900 shadow-sm transition-colors hover:bg-gold-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isPending ? "Saving…" : unavailable ? "Not available" : "Save pick"}
          </button>
          {message && <p className="mt-2 text-sm text-foreground/70">{message}</p>}
        </div>
      )}
    </div>
  );
}
