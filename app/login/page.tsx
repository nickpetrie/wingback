"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// The five friends this whole app is for — a friendly, familiar touch on
// what would otherwise be a bare email form.
const ENTRANT_FIRST_NAMES = ["Nick", "Tom", "Alex", "Henry", "Casra"];

export default function LoginPage() {
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

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/confirm`,
      },
    });

    if (error) {
      setStatus("error");
      setError(error.message);
      return;
    }
    setStatus("idle");
    setStep("sent");
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setStatus("working");
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: "email",
    });

    if (error) {
      setStatus("error");
      setError(error.message);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 360, margin: "0 auto" }}>
        <span style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 28, letterSpacing: "-.02em", color: "var(--color-accent)" }}>
          WINGBACK
        </span>
        <p style={{ margin: "8px 0 4px", fontSize: 14, color: "color-mix(in srgb, var(--color-text) 70%, transparent)" }}>
          The gang&rsquo;s Premier League goalscorer sweepstake.
        </p>
        <p
          style={{
            margin: "0 0 24px",
            fontSize: 12,
            letterSpacing: ".04em",
            color: "color-mix(in srgb, var(--color-text) 50%, transparent)",
          }}
        >
          {ENTRANT_FIRST_NAMES.join(" · ")}
        </p>

        {step === "email" ? (
          <form onSubmit={sendCode} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <p style={{ margin: 0, fontSize: 14, color: "color-mix(in srgb, var(--color-text) 60%, transparent)" }}>
              Sign in with your email — no password needed.
            </p>
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
              />
            </div>
            <button type="submit" className="btn btn-primary wb-tap" disabled={status === "working"}>
              {status === "working" ? "Sending…" : "Email me a link"}
            </button>
            {status === "error" && (
              <p style={{ margin: 0, background: "var(--color-accent-100)", color: "var(--color-accent-800)", fontSize: 12, padding: "8px 10px", borderLeft: "3px solid var(--color-accent)" }}>
                {error}
              </p>
            )}
          </form>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ background: "var(--color-accent-100)", padding: "16px 14px", borderLeft: "3px solid var(--color-accent)" }}>
              <p style={{ margin: 0, fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 16, color: "var(--color-accent-800)" }}>
                Check your email
              </p>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--color-accent-800)" }}>
                We sent a link to <strong>{email}</strong> — tap it on this device to sign in. (Worth a peek in
                spam for your first login.)
              </p>
            </div>

            {!showCodeEntry ? (
              <button
                type="button"
                className="btn btn-ghost wb-tap"
                style={{ alignSelf: "flex-start", padding: 0 }}
                onClick={() => setShowCodeEntry(true)}
              >
                Got a 6-digit code instead? Enter it here
              </button>
            ) : (
              <form onSubmit={verifyCode} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div className="field">
                  <label htmlFor="wb-code">Code</label>
                  <input
                    id="wb-code"
                    className="input"
                    type="text"
                    inputMode="numeric"
                    required
                    placeholder="123456"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    style={{ textAlign: "center", fontSize: 18, letterSpacing: "0.3em" }}
                  />
                </div>
                <button type="submit" className="btn btn-primary wb-tap" disabled={status === "working"}>
                  {status === "working" ? "Verifying…" : "Verify"}
                </button>
              </form>
            )}

            {status === "error" && (
              <p style={{ margin: 0, background: "var(--color-accent-100)", color: "var(--color-accent-800)", fontSize: 12, padding: "8px 10px", borderLeft: "3px solid var(--color-accent)" }}>
                {error}
              </p>
            )}
            <button
              type="button"
              className="btn btn-ghost wb-tap"
              style={{ alignSelf: "flex-start", padding: 0 }}
              onClick={() => {
                setStep("email");
                setShowCodeEntry(false);
              }}
            >
              Use a different email
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
