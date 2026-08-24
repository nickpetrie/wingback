"use client";

import { useState, useTransition } from "react";
import type { PlayerOption } from "@/lib/players";
import { PlayerSearchInput } from "../PlayerSearchInput";
import { AvatarUploader } from "../AvatarUploader";
import { updateNomination, updatePhone } from "./actions";

export function SettingsForm({
  entrantId,
  displayName,
  initialPhone,
  initialSmsOptIn,
  players,
  initialNomination,
}: {
  entrantId: string;
  displayName: string;
  initialPhone: string;
  initialSmsOptIn: boolean;
  players: PlayerOption[];
  initialNomination: PlayerOption | null;
}) {
  const [phone, setPhone] = useState(initialPhone);
  const [smsOptIn, setSmsOptIn] = useState(initialSmsOptIn);
  const [phoneMessage, setPhoneMessage] = useState<string | null>(null);
  const [phonePending, startPhoneTransition] = useTransition();

  const [nomination, setNomination] = useState<PlayerOption | null>(initialNomination);
  const [nominationMessage, setNominationMessage] = useState<string | null>(null);
  const [nominationPending, startNominationTransition] = useTransition();

  const initials = displayName
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  function savePhone(e: React.FormEvent) {
    e.preventDefault();
    setPhoneMessage(null);
    startPhoneTransition(async () => {
      const result = await updatePhone(phone, smsOptIn);
      setPhoneMessage(result.ok ? "Saved." : `Could not save: ${result.error}`);
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
      <section className="rounded-2xl border border-foreground/10 bg-surface p-5 text-center shadow-sm backdrop-blur-sm">
        <h2 className="font-semibold text-foreground">{displayName}</h2>
        <div className="mt-3 flex justify-center">
          <AvatarUploader entrantId={entrantId} initials={initials} />
        </div>
      </section>

      <section className="rounded-2xl border border-foreground/10 bg-surface p-5 shadow-sm backdrop-blur-sm">
        <h2 className="font-semibold text-foreground">Mobile number</h2>
        <p className="mt-1 text-sm text-foreground/50">
          For the T-2h reminder text, if you haven&rsquo;t picked yet.
        </p>
        <form onSubmit={savePhone} className="mt-3 flex flex-col gap-2">
          <input
            type="tel"
            placeholder="+44 7…"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="rounded-full border border-foreground/15 bg-cream px-4 py-2 text-sm text-pitch-900 focus:border-pitch-500 focus:outline-none focus:ring-2 focus:ring-pitch-500/20"
          />
          <label className="flex items-center gap-2 text-sm text-foreground/70">
            <input
              type="checkbox"
              checked={smsOptIn}
              onChange={(e) => setSmsOptIn(e.target.checked)}
              className="rounded"
            />
            Text me reminders
          </label>
          <button
            type="submit"
            disabled={phonePending}
            className="self-start rounded-full bg-gold-500 px-4 py-2 text-sm font-semibold text-pitch-900 hover:bg-gold-400 disabled:opacity-40"
          >
            {phonePending ? "Saving…" : "Save"}
          </button>
        </form>
        {phoneMessage && <p className="mt-2 text-sm text-foreground/70">{phoneMessage}</p>}
      </section>

      <section className="rounded-2xl border border-foreground/10 bg-surface p-5 shadow-sm backdrop-blur-sm">
        <h2 className="font-semibold text-foreground">Nominated player</h2>
        <p className="mt-1 text-sm text-foreground/50">
          Your one player who can be picked twice this season. Meant to be set before gameweek 1 —
          you can still change it, but that&rsquo;s on trust.
        </p>

        {nomination && (
          <div className="mt-3 flex items-center justify-between rounded-full bg-gold-500/15 px-4 py-2">
            <span className="text-sm font-medium text-foreground">
              {nomination.web_name} <span className="text-foreground/40">· {nomination.team_short_name}</span>
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
        {nominationPending && <p className="mt-2 text-sm text-foreground/50">Saving…</p>}
        {nominationMessage && !nominationPending && (
          <p className="mt-2 text-sm text-foreground/70">{nominationMessage}</p>
        )}
      </section>
    </div>
  );
}
