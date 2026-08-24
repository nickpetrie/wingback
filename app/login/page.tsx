"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
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
    setStep("code");
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
        <span style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 24, letterSpacing: "-.02em", color: "var(--color-accent)" }}>
          WINGBACK
        </span>
        <p style={{ margin: "8px 0 24px", fontSize: 14, color: "color-mix(in srgb, var(--color-text) 60%, transparent)" }}>
          Sign in with your email — no password needed.
        </p>

        {step === "email" ? (
          <form onSubmit={sendCode} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
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
              {status === "working" ? "Sending…" : "Send code"}
            </button>
            {status === "error" && (
              <p style={{ margin: 0, background: "var(--color-accent-100)", color: "var(--color-accent-800)", fontSize: 12, padding: "8px 10px", borderLeft: "3px solid var(--color-accent)" }}>
                {error}
              </p>
            )}
          </form>
        ) : (
          <form onSubmit={verifyCode} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <p style={{ margin: 0, fontSize: 13, background: "var(--color-surface)", padding: 12, color: "color-mix(in srgb, var(--color-text) 70%, transparent)" }}>
              Check your email — enter the 6-digit code it contains below. (You can also click the link in that
              email instead, if you&rsquo;d rather.)
            </p>
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
            {status === "error" && (
              <p style={{ margin: 0, background: "var(--color-accent-100)", color: "var(--color-accent-800)", fontSize: 12, padding: "8px 10px", borderLeft: "3px solid var(--color-accent)" }}>
                {error}
              </p>
            )}
            <button type="button" className="btn btn-ghost wb-tap" onClick={() => setStep("email")}>
              Use a different email
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
