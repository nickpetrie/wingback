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
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Wingback</h1>
        <p className="text-sm text-neutral-500">
          Sign in with your email — no password needed.
        </p>
      </div>

      {step === "email" ? (
        <form onSubmit={sendCode} className="flex flex-col gap-3">
          <input
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={status === "working"}
            className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {status === "working" ? "Sending…" : "Send code"}
          </button>
          {status === "error" && <p className="text-sm text-red-600">{error}</p>}
        </form>
      ) : (
        <form onSubmit={verifyCode} className="flex flex-col gap-3">
          <p className="rounded-md bg-green-50 p-3 text-sm text-green-800">
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
            className="rounded-md border border-neutral-300 px-3 py-2 text-center text-lg tracking-widest"
          />
          <button
            type="submit"
            disabled={status === "working"}
            className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {status === "working" ? "Verifying…" : "Verify"}
          </button>
          {status === "error" && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="button"
            onClick={() => setStep("email")}
            className="text-sm text-neutral-500 underline"
          >
            Use a different email
          </button>
        </form>
      )}
    </main>
  );
}
