"use client";

import { useState, useTransition } from "react";
import type { PlayerOption } from "@/lib/players";
import { teamColor } from "@/lib/teamColors";
import { PlayerSearchInput } from "../PlayerSearchInput";
import { TeamBadge } from "../TeamBadge";
import { initialsFor } from "@/lib/avatar";
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
  const [changingNomination, setChangingNomination] = useState(!initialNomination);
  const [nominationMessage, setNominationMessage] = useState<string | null>(null);
  const [nominationPending, startNominationTransition] = useTransition();


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
    setChangingNomination(false);
    setNominationMessage(null);
    startNominationTransition(async () => {
      const result = await updateNomination(player.code);
      setNominationMessage(result.ok ? "Saved." : `Could not save: ${result.error}`);
    });
  }

  return (
    <div>
      <section style={{ padding: "24px 0", borderBottom: "1px solid var(--color-divider)", display: "flex", gap: 20, alignItems: "center" }}>
        <AvatarUploader entrantId={entrantId} initials={initialsFor(displayName)} />
        <div>
          <p style={{ margin: 0, fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 22 }}>{displayName}</p>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: "color-mix(in srgb, var(--color-text) 55%, transparent)" }}>
            Shows up in the standings strip, next to your name.
          </p>
        </div>
      </section>

      <section style={{ padding: "24px 0", borderBottom: "1px solid var(--color-divider)" }}>
        <h6 style={{ margin: "0 0 4px" }}>Mobile number</h6>
        <p style={{ margin: "0 0 12px", fontSize: 13, color: "color-mix(in srgb, var(--color-text) 60%, transparent)" }}>
          For the nudge two hours before lock, if you still haven&rsquo;t picked.
        </p>
        <form onSubmit={savePhone} style={{ display: "flex", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
          <input
            className="input"
            type="tel"
            placeholder="+44 7…"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            style={{ maxWidth: 220 }}
          />
          <button type="submit" className="btn btn-primary wb-tap" disabled={phonePending}>
            {phonePending ? "Saving…" : "Save"}
          </button>
        </form>
        <label className="radio" style={{ marginTop: 12 }}>
          <input type="checkbox" checked={smsOptIn} onChange={(e) => setSmsOptIn(e.target.checked)} />
          <span className="dot" />
          Text me reminders
        </label>
        {phoneMessage && <p style={{ marginTop: 8, fontSize: 13, color: "color-mix(in srgb, var(--color-text) 60%, transparent)" }}>{phoneMessage}</p>}
      </section>

      <section style={{ padding: "24px 0" }}>
        <h6 style={{ margin: "0 0 4px" }}>Nominated player</h6>
        <p style={{ margin: "0 0 12px", fontSize: 13, color: "color-mix(in srgb, var(--color-text) 60%, transparent)" }}>
          Your one player who can be picked twice. Meant to be locked before gameweek 1 — you can still change it,
          but the others will hear about it.
        </p>

        {nomination && !changingNomination ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              background: "var(--color-surface)",
              padding: "12px 14px",
              borderLeft: `3px solid ${teamColor(nomination.team_short_name)}`,
            }}
          >
            <span style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 18 }}>{nomination.web_name}</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "color-mix(in srgb, var(--color-text) 55%, transparent)" }}>
              <TeamBadge code={nomination.team_code} size={14} />
              {nomination.team_short_name}
            </span>
            <button
              type="button"
              className="btn btn-ghost wb-tap"
              style={{ marginLeft: "auto" }}
              onClick={() => setChangingNomination(true)}
            >
              Change
            </button>
          </div>
        ) : (
          <PlayerSearchInput players={players} placeholder="Search for your nominated player…" onSelect={saveNomination} />
        )}
        {nominationPending && <p style={{ marginTop: 8, fontSize: 13, color: "color-mix(in srgb, var(--color-text) 55%, transparent)" }}>Saving…</p>}
        {nominationMessage && !nominationPending && (
          <p style={{ marginTop: 8, fontSize: 13, color: "color-mix(in srgb, var(--color-text) 60%, transparent)" }}>{nominationMessage}</p>
        )}
      </section>
    </div>
  );
}
