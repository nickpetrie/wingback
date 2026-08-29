"use client";

import { useState, useTransition } from "react";
import type { PlayerOption } from "@/lib/players";
import { teamColor } from "@/lib/teamColors";
import { PlayerSearchInput } from "../PlayerSearchInput";
import { TeamBadge } from "../TeamBadge";
import { initialsFor } from "@/lib/avatar";
import { AvatarUploader } from "../AvatarUploader";
import { ThemeToggle } from "../ThemeToggle";
import { updateNomination } from "./actions";

export function SettingsForm({
  entrantId,
  avatarUpdatedAt,
  displayName,
  players,
  initialNomination,
}: {
  entrantId: string;
  avatarUpdatedAt: string | null;
  displayName: string;
  players: PlayerOption[];
  initialNomination: PlayerOption | null;
}) {
  const [nomination, setNomination] = useState<PlayerOption | null>(initialNomination);
  const [changingNomination, setChangingNomination] = useState(!initialNomination);
  const [nominationMessage, setNominationMessage] = useState<string | null>(null);
  const [nominationPending, startNominationTransition] = useTransition();


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
        <AvatarUploader entrantId={entrantId} initials={initialsFor(displayName)} updatedAt={avatarUpdatedAt} />
        <div>
          <p style={{ margin: 0, fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 22 }}>{displayName}</p>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: "color-mix(in srgb, var(--color-text) 55%, transparent)" }}>
            Shows up in the standings strip, next to your name.
          </p>
        </div>
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

      <section style={{ padding: "24px 0", borderTop: "1px solid var(--color-divider)" }}>
        <h6 style={{ margin: "0 0 4px" }}>Appearance</h6>
        <p style={{ margin: "0 0 12px", fontSize: 12, color: "color-mix(in srgb, var(--color-text) 55%, transparent)" }}>
          Auto follows your phone&rsquo;s setting.
        </p>
        <ThemeToggle />
      </section>
    </div>
  );
}
