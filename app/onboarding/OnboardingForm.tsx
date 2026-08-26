"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { PlayerOption } from "@/lib/players";
import { teamBadgeUrl } from "@/lib/team-badge";
import { PlayerSearchInput } from "../PlayerSearchInput";
import { AvatarUploader } from "../AvatarUploader";
import { updateNomination } from "../settings/actions";
import { savePhoneStep } from "./actions";

type Step = 1 | 2 | 3;

export function OnboardingForm({
  entrantId,
  initials,
  initialPhone,
  players,
  initialNomination,
}: {
  entrantId: string;
  initials: string;
  initialPhone: string;
  players: PlayerOption[];
  initialNomination: PlayerOption | null;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);

  const [phone, setPhone] = useState(initialPhone);
  const [smsOptIn, setSmsOptIn] = useState(true);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [phonePending, startPhoneTransition] = useTransition();

  const [nomination, setNomination] = useState<PlayerOption | null>(initialNomination);
  const [nominationError, setNominationError] = useState<string | null>(null);
  const [nominationPending, startNominationTransition] = useTransition();

  function continuePhone() {
    setPhoneError(null);
    startPhoneTransition(async () => {
      const result = await savePhoneStep(phone, smsOptIn);
      if (!result.ok) {
        setPhoneError(result.error ?? "Could not save.");
        return;
      }
      setStep(2);
    });
  }

  function chooseNomination(player: PlayerOption) {
    setNomination(player);
    setNominationError(null);
    startNominationTransition(async () => {
      const result = await updateNomination(player.code);
      if (!result.ok) setNominationError(result.error ?? "Could not save.");
    });
  }

  return (
    <div>
      <StepMarks step={step} />

      {step === 1 && (
        <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <h6 style={{ margin: "0 0 4px" }}>Mobile number</h6>
            <p style={{ margin: 0, fontSize: 13, color: "color-mix(in srgb, var(--color-text) 60%, transparent)" }}>
              For the nudge two hours before lock, if you still haven&rsquo;t picked.
            </p>
          </div>
          <input
            className="input"
            type="tel"
            placeholder="+44 7…"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <label className="radio">
            <input type="checkbox" checked={smsOptIn} onChange={(e) => setSmsOptIn(e.target.checked)} />
            <span className="dot" />
            Text me reminders
          </label>
          {phoneError && (
            <p style={{ margin: 0, background: "var(--color-accent-100)", color: "var(--color-accent-800)", fontSize: 12, padding: "8px 10px", borderLeft: "3px solid var(--color-accent)" }}>
              {phoneError}
            </p>
          )}
          <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
            <button type="button" className="btn btn-primary wb-tap" onClick={continuePhone} disabled={phonePending}>
              {phonePending ? "Saving…" : "Continue"}
            </button>
            <button type="button" className="btn btn-ghost wb-tap" onClick={() => setStep(2)}>
              Skip
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <h6 style={{ margin: "0 0 4px" }}>Your nominated player</h6>
            <p style={{ margin: 0, fontSize: 13, color: "color-mix(in srgb, var(--color-text) 60%, transparent)" }}>
              {initialNomination
                ? "Pulled in from last season's sheet — confirm it's still right, or change it below."
                : "The one player you can pick twice this season, for double points."}
            </p>
          </div>

          {nomination && (
            <div style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--color-surface)", padding: "12px 14px" }}>
              {nomination.team_code && (
                // eslint-disable-next-line @next/next/no-img-element -- external crest CDN, not eligible for next/image
                <img src={teamBadgeUrl(nomination.team_code)} alt="" style={{ width: 32, height: 32 }} />
              )}
              <div>
                <p style={{ margin: 0, fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 16 }}>{nomination.web_name}</p>
                <p style={{ margin: 0, fontSize: 12, color: "color-mix(in srgb, var(--color-text) 55%, transparent)" }}>
                  {nomination.team_short_name}
                </p>
              </div>
            </div>
          )}

          <PlayerSearchInput players={players} placeholder="Search players…" onSelect={chooseNomination} />
          {nominationPending && <p style={{ margin: 0, fontSize: 13, color: "color-mix(in srgb, var(--color-text) 55%, transparent)" }}>Saving…</p>}
          {nominationError && (
            <p style={{ margin: 0, background: "var(--color-accent-100)", color: "var(--color-accent-800)", fontSize: 12, padding: "8px 10px", borderLeft: "3px solid var(--color-accent)" }}>
              {nominationError}
            </p>
          )}

          <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
            <button type="button" className="btn btn-primary wb-tap" onClick={() => setStep(3)} disabled={!nomination}>
              {initialNomination ? "Confirm" : "Continue"}
            </button>
            <button type="button" className="btn btn-ghost wb-tap" onClick={() => setStep(3)}>
              Skip
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div style={{ marginTop: 20, display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <div style={{ textAlign: "center" }}>
            <h6 style={{ margin: "0 0 4px" }}>Add a photo</h6>
            <p style={{ margin: 0, fontSize: 13, color: "color-mix(in srgb, var(--color-text) 60%, transparent)" }}>
              Shows up next to your picks. Optional.
            </p>
          </div>
          <AvatarUploader entrantId={entrantId} initials={initials} updatedAt={null} />
          <button type="button" className="btn btn-primary wb-tap" style={{ width: "100%" }} onClick={() => router.push("/")}>
            Done — take me in
          </button>
        </div>
      )}

      <p style={{ marginTop: 20, textAlign: "center", fontSize: 12, color: "color-mix(in srgb, var(--color-text) 50%, transparent)" }}>
        Everything here can be changed anytime in Settings.
      </p>
    </div>
  );
}

function StepMarks({ step }: { step: Step }) {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      {([1, 2, 3] as const).map((s) => (
        <span
          key={s}
          style={{
            height: 4,
            width: 32,
            background: s <= step ? "var(--color-accent)" : "var(--color-divider)",
          }}
        />
      ))}
    </div>
  );
}
