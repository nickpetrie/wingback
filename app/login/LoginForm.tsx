"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoginHero } from "./LoginHero";
import { sendMagicLink, verifyLoginCode } from "./actions";

/** A button that keeps its label — and so its width — while it works.
 *
 * Swapping "Email me a link" for "Sending…" moved the button under the
 * thumb that had just pressed it and read as a stall. The label stays put
 * and a spinner appears beside it instead. */
function SubmitButton({ busy, children }: { busy: boolean; children: React.ReactNode }) {
  return (
    <button type="submit" className="btn btn-primary wb-tap wb-login-submit" disabled={busy} aria-busy={busy}>
      {busy && <span className="wb-spinner" aria-hidden="true" />}
      {children}
    </button>
  );
}

function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="wb-login-error" role="alert">
      {children}
    </p>
  );
}

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "sent">("email");
  const [showCodeEntry, setShowCodeEntry] = useState(false);
  const [status, setStatus] = useState<"idle" | "working" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setStatus("working");
    setError(null);

    const result = await sendMagicLink(email);

    if (!result.ok) {
      setStatus("error");
      setError(result.error ?? "Could not send the link.");
      return;
    }
    setStatus("idle");
    setStep("sent");
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setStatus("working");
    setError(null);

    const result = await verifyLoginCode(email, code);

    if (!result.ok) {
      setStatus("error");
      setError(result.error ?? "Could not verify that code.");
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <main className="wb-login-page">
      <LoginHero />

      <div className="wb-login-form-panel">
        <div className="wb-login-form-inner">
          <h6 style={{ margin: "0 0 16px" }}>Sign in</h6>

          {step === "email" ? (
            // key: the step swap re-runs the entrance animation, so moving on
            // reads as a step forward rather than as content silently replaced.
            <form key="email" className="wb-login-step" onSubmit={sendCode}>
              <p className="wb-login-hint">Sign in with your email — no password needed.</p>
              <div className="field">
                <label htmlFor="wb-email">Email</label>
                <input
                  id="wb-email"
                  className="input"
                  type="email"
                  required
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  // The fastest sign-in is the one you don't type: with these
                  // the address comes from the keyboard's own suggestion strip
                  // (or the password manager) in a single tap, and the keyboard
                  // that appears has an @ on it and a Go key instead of return.
                  // iOS ignores autoFocus without a gesture, so it only helps
                  // on desktop rather than ambushing a phone with a keyboard.
                  autoFocus
                  autoComplete="email"
                  inputMode="email"
                  enterKeyHint="go"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                />
              </div>
              <SubmitButton busy={status === "working"}>Email me a link</SubmitButton>
              {status === "error" && <ErrorNote>{error}</ErrorNote>}
            </form>
          ) : (
            <div key="sent" className="wb-login-step">
              <div className="wb-login-sent">
                <p className="wb-login-sent-title">Check your email</p>
                <p className="wb-login-sent-body">
                  We sent a link to <strong>{email}</strong> — tap it on this device to sign
                  in. (Worth a peek in spam for your first login.)
                </p>
              </div>

              {!showCodeEntry ? (
                <button
                  type="button"
                  className="btn btn-ghost wb-tap wb-login-alt"
                  onClick={() => setShowCodeEntry(true)}
                >
                  Got a 6-digit code instead? Enter it here
                </button>
              ) : (
                <form onSubmit={verifyCode} className="wb-login-step">
                  <div className="field">
                    <label htmlFor="wb-code">Code</label>
                    <input
                      id="wb-code"
                      className="input wb-login-code"
                      type="text"
                      required
                      placeholder="123456"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      // one-time-code is what makes iOS offer the digits
                      // straight from the notification banner, turning
                      // "memorise six numbers and come back" into one tap.
                      autoComplete="one-time-code"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      enterKeyHint="go"
                      autoFocus
                    />
                  </div>
                  <SubmitButton busy={status === "working"}>Verify</SubmitButton>
                </form>
              )}

              {status === "error" && <ErrorNote>{error}</ErrorNote>}
              <button
                type="button"
                className="btn btn-ghost wb-tap wb-login-alt"
                onClick={() => {
                  setStep("email");
                  setShowCodeEntry(false);
                  setStatus("idle");
                  setError(null);
                }}
              >
                Use a different email
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
