"use client";

import { useState, useTransition } from "react";
import type { PlayerOption } from "@/lib/players";
import { PlayerSearchInput } from "../PlayerSearchInput";
import { updateDisplayName, updateNomination } from "./actions";

export function SettingsForm({
  initialDisplayName,
  players,
  initialNomination,
}: {
  initialDisplayName: string;
  players: PlayerOption[];
  initialNomination: PlayerOption | null;
}) {
  const [name, setName] = useState(initialDisplayName);
  const [nameMessage, setNameMessage] = useState<string | null>(null);
  const [namePending, startNameTransition] = useTransition();

  const [nomination, setNomination] = useState<PlayerOption | null>(initialNomination);
  const [nominationMessage, setNominationMessage] = useState<string | null>(null);
  const [nominationPending, startNominationTransition] = useTransition();

  function saveName(e: React.FormEvent) {
    e.preventDefault();
    setNameMessage(null);
    startNameTransition(async () => {
      const result = await updateDisplayName(name);
      setNameMessage(result.ok ? "Saved." : `Could not save: ${result.error}`);
    });
  }

  function saveNomination(player: PlayerOption) {
    setNomination(player);
    setNominationMessage(null);
    startNominationTransition(async () => {
      const result = await updateNomination(player.code);
      setNominationMessage(result.ok ? "Saved." : `Could not save: ${result.error}`);
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="rounded-2xl border border-pitch-900/10 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-pitch-900">Display name</h2>
        <p className="mt-1 text-sm text-pitch-900/50">
          What the others see on the leaderboard and revealed picks.
        </p>
        <form onSubmit={saveName} className="mt-3 flex gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 rounded-full border border-pitch-900/15 px-4 py-2 text-sm focus:border-pitch-500 focus:outline-none focus:ring-2 focus:ring-pitch-500/20"
          />
          <button
            type="submit"
            disabled={namePending}
            className="rounded-full bg-pitch-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            {namePending ? "Saving…" : "Save"}
          </button>
        </form>
        {nameMessage && <p className="mt-2 text-sm text-pitch-900/70">{nameMessage}</p>}
      </section>

      <section className="rounded-2xl border border-pitch-900/10 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-pitch-900">Nominated player</h2>
        <p className="mt-1 text-sm text-pitch-900/50">
          Your one player who can be picked twice this season. Meant to be set before gameweek 1 —
          you can still change it, but that&rsquo;s on trust.
        </p>

        {nomination && (
          <div className="mt-3 flex items-center justify-between rounded-full bg-gold-500/15 px-4 py-2">
            <span className="text-sm font-medium text-pitch-900">
              {nomination.web_name} <span className="text-pitch-900/40">· {nomination.team_short_name}</span>
            </span>
          </div>
        )}

        <div className="mt-3">
          <PlayerSearchInput
            players={players}
            placeholder="Search for your nominated player…"
            onSelect={saveNomination}
          />
        </div>
        {nominationPending && <p className="mt-2 text-sm text-pitch-900/50">Saving…</p>}
        {nominationMessage && !nominationPending && (
          <p className="mt-2 text-sm text-pitch-900/70">{nominationMessage}</p>
        )}
      </section>
    </div>
  );
}
