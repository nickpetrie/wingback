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
    <div className="flex flex-col gap-6">
      <StepDots step={step} />

      {step === 1 && (
        <div className="flex flex-col gap-3">
          <div>
            <h2 className="font-semibold text-foreground">Mobile number</h2>
            <p className="text-xs text-foreground/50">
              For the T-2h reminder text, if you haven&rsquo;t picked yet.
            </p>
          </div>
          <input
            type="tel"
            placeholder="+44 7…"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-full border border-foreground/15 bg-cream px-4 py-2.5 text-sm text-pitch-900 focus:border-pitch-500 focus:outline-none focus:ring-2 focus:ring-pitch-500/20"
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
          {phoneError && <p className="text-sm text-red-400">{phoneError}</p>}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={continuePhone}
              disabled={phonePending}
              className="flex-1 rounded-full bg-gold-500 px-4 py-2.5 text-sm font-semibold text-pitch-900 shadow-sm hover:bg-gold-400 disabled:opacity-40"
            >
              {phonePending ? "Saving…" : "Continue"}
            </button>
            <button
              type="button"
              onClick={() => setStep(2)}
              className="rounded-full px-4 py-2.5 text-sm font-medium text-foreground/50 hover:text-foreground"
            >
              Skip
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-3">
          <div>
            <h2 className="font-semibold text-foreground">Your nominated player</h2>
            <p className="text-xs text-foreground/50">
              {initialNomination
                ? "Pulled in from last season's sheet — confirm it's still right, or change it below."
                : "The one player you can pick twice this season, for double points."}
            </p>
          </div>

          {nomination ? (
            <div className="flex items-center gap-3 rounded-2xl border border-foreground/10 bg-surface p-4 backdrop-blur-sm">
              {nomination.team_code && (
                // eslint-disable-next-line @next/next/no-img-element -- external crest CDN, not eligible for next/image
                <img src={teamBadgeUrl(nomination.team_code)} alt="" className="h-10 w-10" />
              )}
              <div>
                <p className="font-semibold text-foreground">{nomination.web_name}</p>
                <p className="text-sm text-foreground/50">{nomination.team_short_name}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-foreground/50">Search for the player you want to nominate.</p>
          )}

          <PlayerSearchInput players={players} placeholder="Search players…" onSelect={chooseNomination} />
          {nominationPending && <p className="text-sm text-foreground/50">Saving…</p>}
          {nominationError && <p className="text-sm text-red-400">{nominationError}</p>}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep(3)}
              disabled={!nomination}
              className="flex-1 rounded-full bg-gold-500 px-4 py-2.5 text-sm font-semibold text-pitch-900 shadow-sm hover:bg-gold-400 disabled:opacity-40"
            >
              {initialNomination ? "Confirm" : "Continue"}
            </button>
            <button
              type="button"
              onClick={() => setStep(3)}
              className="rounded-full px-4 py-2.5 text-sm font-medium text-foreground/50 hover:text-foreground"
            >
              Skip
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="flex flex-col items-center gap-4">
          <div className="text-center">
            <h2 className="font-semibold text-foreground">Add a photo</h2>
            <p className="text-xs text-foreground/50">Shows up next to your picks. Optional.</p>
          </div>
          <AvatarUploader entrantId={entrantId} initials={initials} />
          <button
            type="button"
            onClick={() => router.push("/")}
            className="w-full rounded-full bg-gold-500 px-4 py-2.5 text-sm font-semibold text-pitch-900 shadow-sm hover:bg-gold-400"
          >
            Done — take me in
          </button>
        </div>
      )}

      <p className="text-center text-xs text-foreground/40">
        Everything here can be changed anytime in Settings.
      </p>
    </div>
  );
}

function StepDots({ step }: { step: Step }) {
  return (
    <div className="flex justify-center gap-2">
      {([1, 2, 3] as const).map((s) => (
        <span key={s} className={`h-1.5 w-6 rounded-full ${s <= step ? "bg-gold-500" : "bg-foreground/10"}`} />
      ))}
    </div>
  );
}
