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
    router.push("/pick");
    router.refresh();
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-pitch-600/25 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 right-0 h-72 w-72 rounded-full bg-gold-500/10 blur-3xl"
      />
      <div className="relative w-full max-w-sm rounded-3xl border border-foreground/10 bg-surface-strong p-8 shadow-xl backdrop-blur-md">
        <div className="mb-6 text-center">
          <p className="text-3xl">⚽</p>
          <h1 className="mt-2 text-2xl font-extrabold text-foreground">Wingback</h1>
          <p className="mt-1 text-sm text-foreground/50">Sign in with your email — no password needed.</p>
        </div>

        {step === "email" ? (
          <form onSubmit={sendCode} className="flex flex-col gap-3">
            <input
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-full border border-foreground/15 bg-cream px-4 py-2.5 text-sm text-pitch-900 focus:border-pitch-500 focus:outline-none focus:ring-2 focus:ring-pitch-500/20"
            />
            <button
              type="submit"
              disabled={status === "working"}
              className="rounded-full bg-gold-500 px-4 py-2.5 text-sm font-semibold text-pitch-900 shadow-sm transition-colors hover:bg-gold-400 disabled:opacity-50"
            >
              {status === "working" ? "Sending…" : "Send code"}
            </button>
            {status === "error" && <p className="text-sm text-red-400">{error}</p>}
          </form>
        ) : (
          <form onSubmit={verifyCode} className="flex flex-col gap-3">
            <p className="rounded-xl bg-surface p-3 text-sm text-foreground/70">
              Check your email — enter the 6-digit code it contains below. (You can also click the
              link in that email instead, if you&rsquo;d rather.)
            </p>
            <input
              type="text"
              inputMode="numeric"
              required
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="rounded-full border border-foreground/15 bg-cream px-4 py-2.5 text-center text-lg tracking-[0.3em] text-pitch-900 focus:border-pitch-500 focus:outline-none focus:ring-2 focus:ring-pitch-500/20"
            />
            <button
              type="submit"
              disabled={status === "working"}
              className="rounded-full bg-gold-500 px-4 py-2.5 text-sm font-semibold text-pitch-900 shadow-sm transition-colors hover:bg-gold-400 disabled:opacity-50"
            >
              {status === "working" ? "Verifying…" : "Verify"}
            </button>
            {status === "error" && <p className="text-sm text-red-400">{error}</p>}
            <button
              type="button"
              onClick={() => setStep("email")}
              className="text-sm text-foreground/50 underline"
            >
              Use a different email
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
