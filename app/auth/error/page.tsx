export default function AuthErrorPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-6 text-center">
      <h1 className="text-xl font-semibold text-foreground">Sign-in link expired</h1>
      <p className="text-sm text-foreground/60">
        Magic links only work once and expire quickly. Head back and request a new one.
      </p>
      <a href="/login" className="text-sm font-medium text-gold-400 underline">
        Back to sign in
      </a>
    </main>
  );
}
