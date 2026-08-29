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
  nominationsLocked,
  lockGameweek,
}: {
  entrantId: string;
  avatarUpdatedAt: string | null;
  displayName: string;
  players: PlayerOption[];
  initialNomination: PlayerOption | null;
  nominationsLocked: boolean;
  lockGameweek: number | null;
}) {
  const [nomination, setNomination] = useState<PlayerOption | null>(initialNomination);
  // Locked *and* already nominated means there is nothing to change. Locked
  // with nothing set still lets you set one, or you'd lose the second use
  // entirely — see the trigger in 20260101000026.
  const canChange = !nominationsLocked || !initialNomination;
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
      <section style={{ padding: "24px 0" }}>
        <div className="wb-settings-head">
          <h6 style={{ margin: 0 }}>Profile</h6>
        </div>
        <div style={{ display: "flex", gap: 20, alignItems: "center", marginTop: 16 }}>
        <AvatarUploader entrantId={entrantId} initials={initialsFor(displayName)} updatedAt={avatarUpdatedAt} />
        <div>
          <p style={{ margin: 0, fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 22 }}>{displayName}</p>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: "color-mix(in srgb, var(--color-text) 55%, transparent)" }}>
            Shows up in the standings strip, next to your name.
          </p>
        </div>
        </div>
      </section>

      <section style={{ padding: "24px 0" }}>
        <div className="wb-settings-head">
          <h6 style={{ margin: 0 }}>Nomination</h6>
          {nominationsLocked && (
            <span className="wb-settings-locked">LOCKED</span>
          )}
        </div>
        <p className="wb-settings-note">
          Your one player who can be picked twice.{" "}
          {nominationsLocked
            ? "Nominations closed at the end of the gameweek, so this is your player for the season."
            : lockGameweek !== null
              ? `It locks for the season when gameweek ${lockGameweek} finishes — after that it can't be changed.`
              : "It locks once the season is under way."}
        </p>

        {nomination && (!changingNomination || !canChange) ? (
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
            {canChange && (
              <button
                type="button"
                className="btn btn-ghost wb-tap"
                style={{ marginLeft: "auto" }}
                onClick={() => setChangingNomination(true)}
              >
                Change
              </button>
            )}
          </div>
        ) : (
          <PlayerSearchInput players={players} placeholder="Search for your nominated player…" onSelect={saveNomination} />
        )}
        {nominationPending && <p style={{ marginTop: 8, fontSize: 13, color: "color-mix(in srgb, var(--color-text) 55%, transparent)" }}>Saving…</p>}
        {nominationMessage && !nominationPending && (
          <p style={{ marginTop: 8, fontSize: 13, color: "color-mix(in srgb, var(--color-text) 60%, transparent)" }}>{nominationMessage}</p>
        )}
      </section>

      <section style={{ padding: "24px 0" }}>
        <div className="wb-settings-head">
          <h6 style={{ margin: 0 }}>Appearance</h6>
        </div>
        <p className="wb-settings-note">Auto follows your phone&rsquo;s setting.</p>
        <ThemeToggle />
      </section>
    </div>
  );
}
