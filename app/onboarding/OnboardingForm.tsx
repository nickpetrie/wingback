"use client";

import { useState, useTransition } from "react";
import { AvatarUploader } from "../AvatarUploader";
import { finishOnboarding, skipOnboarding } from "./actions";

export function OnboardingForm({
  entrantId,
  initials,
  initialPhone,
}: {
  entrantId: string;
  initials: string;
  initialPhone: string;
}) {
  const [phone, setPhone] = useState(initialPhone);
  const [smsOptIn, setSmsOptIn] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await finishOnboarding(phone, smsOptIn);
      if (!result.ok) setError(result.error ?? "Could not save.");
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <AvatarUploader entrantId={entrantId} initials={initials} />

      <div>
        <label className="text-sm font-medium text-pitch-900">Mobile number</label>
        <p className="text-xs text-pitch-900/50">For the T-2h reminder text, if you haven&rsquo;t picked yet.</p>
        <input
          type="tel"
          placeholder="+44 7…"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="mt-2 w-full rounded-full border border-pitch-900/15 px-4 py-2.5 text-sm focus:border-pitch-500 focus:outline-none focus:ring-2 focus:ring-pitch-500/20"
        />
        <label className="mt-2 flex items-center gap-2 text-sm text-pitch-900/70">
          <input
            type="checkbox"
            checked={smsOptIn}
            onChange={(e) => setSmsOptIn(e.target.checked)}
            className="rounded"
          />
          Text me reminders
        </label>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="flex-1 rounded-full bg-pitch-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-pitch-600 disabled:opacity-40"
        >
          {isPending ? "Saving…" : "Save & continue"}
        </button>
        <button
          type="button"
          onClick={() => skipOnboarding()}
          className="rounded-full px-4 py-2.5 text-sm font-medium text-pitch-900/50 hover:text-pitch-900"
        >
          Skip for now
        </button>
      </div>
      <p className="text-center text-xs text-pitch-900/40">
        Both are optional — add or change them anytime in Settings.
      </p>
    </form>
  );
}
