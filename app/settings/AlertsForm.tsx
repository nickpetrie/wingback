"use client";

import { useState, useTransition } from "react";
import { ALERT_TYPES, CHANNELS, type AlertPrefs } from "@/lib/alerts";
import { PushToggle } from "../PushToggle";
import { updateAlertPrefs, updatePhone } from "./actions";

/** Alerts: what you want to hear about, and how you want to hear it.
 *
 * One screen rather than the three places this used to live (an SMS checkbox
 * next to the phone field, a push button under a "Notifications" heading, and
 * a set of email reminders nobody could see at all, let alone turn off). */
export function AlertsForm({
  initialPrefs,
  initialPhone,
  email,
}: {
  initialPrefs: AlertPrefs;
  initialPhone: string;
  email: string | null;
}) {
  const [prefs, setPrefs] = useState(initialPrefs);
  const [phone, setPhone] = useState(initialPhone);
  const [phoneMessage, setPhoneMessage] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [phonePending, startPhoneTransition] = useTransition();

  // Autosaved, like the pick form: a settings screen with a Save button is a
  // settings screen people leave without pressing it.
  function set(key: keyof AlertPrefs, value: boolean) {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    setError(null);
    startTransition(async () => {
      const result = await updateAlertPrefs(next);
      if (result.ok) {
        setStatus("saved");
      } else {
        setStatus("error");
        setError(result.error ?? "Could not save.");
        setPrefs(prefs); // put the switch back where it was
      }
    });
  }

  function savePhone(e: React.FormEvent) {
    e.preventDefault();
    setPhoneMessage(null);
    startPhoneTransition(async () => {
      const result = await updatePhone(phone);
      setPhoneMessage(result.ok ? "Saved." : `Could not save: ${result.error}`);
    });
  }

  const nothingOn = !prefs.email && !prefs.sms && !prefs.push;
  const smsWithoutNumber = prefs.sms && phone.trim().length === 0;

  return (
    <section style={{ padding: "24px 0" }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
          borderBottom: "2px solid var(--color-divider)",
          paddingBottom: 8,
        }}
      >
        <h6 style={{ margin: 0 }}>Alerts</h6>
        <span
          aria-live="polite"
          style={{
            fontSize: 11,
            color: status === "error" ? "var(--color-closed)" : "color-mix(in srgb, var(--color-text) 50%, transparent)",
          }}
        >
          {status === "error" ? error : status === "saved" ? "Saved" : ""}
        </span>
      </div>

      <p className="wb-alert-intro">
        Pick what you want to hear about, then how. Everything you switch on also shows up under
        the bell on the home screen, whether or not it reaches you any other way.
      </p>

      <h6 className="wb-alert-head">How</h6>
      <div className="wb-alert-list">
        {CHANNELS.map((c) => (
          <label key={c.key} className="wb-alert-row">
            <span className="wb-alert-text">
              <span className="wb-alert-label">{c.label}</span>
              <span className="wb-alert-note">
                {c.key === "email" && email ? `To ${email}.` : c.note}
              </span>
            </span>
            <input
              type="checkbox"
              className="wb-switch"
              checked={prefs[c.key]}
              onChange={(e) => set(c.key, e.target.checked)}
            />
          </label>
        ))}
      </div>

      {nothingOn && (
        <p className="wb-alert-warn" role="status">
          Nothing will reach your phone or inbox. Alerts still collect under the bell.
        </p>
      )}

      {prefs.sms && (
        <form onSubmit={savePhone} className="wb-alert-phone">
          <div className="field" style={{ flex: 1, minWidth: 0 }}>
            <label htmlFor="wb-phone">Mobile number</label>
            <input
              id="wb-phone"
              className="input"
              type="tel"
              inputMode="tel"
              placeholder="+44…"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-secondary wb-tap" disabled={phonePending}>
            {phonePending ? "Saving…" : "Save"}
          </button>
        </form>
      )}
      {smsWithoutNumber && (
        <p className="wb-alert-warn" role="status">
          SMS is on but there&rsquo;s no number saved, so nothing can be sent.
        </p>
      )}
      {phoneMessage && <p className="wb-alert-note">{phoneMessage}</p>}

      {prefs.push && (
        <div className="wb-alert-phone">
          <PushToggle />
        </div>
      )}

      <h6 className="wb-alert-head">What</h6>
      <div className="wb-alert-list">
        {ALERT_TYPES.map((t) => (
          <label key={t.key} className="wb-alert-row">
            <span className="wb-alert-text">
              <span className="wb-alert-label">{t.label}</span>
              <span className="wb-alert-note">{t.note}</span>
            </span>
            <input
              type="checkbox"
              className="wb-switch"
              checked={prefs[t.key]}
              onChange={(e) => set(t.key, e.target.checked)}
            />
          </label>
        ))}
      </div>
    </section>
  );
}
