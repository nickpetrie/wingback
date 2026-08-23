export default function AuthErrorPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-6 text-center">
      <h1 className="text-xl font-semibold">Sign-in link expired</h1>
      <p className="text-sm text-neutral-500">
        Magic links only work once and expire quickly. Head back and request a new one.
      </p>
      <a href="/login" className="text-sm font-medium underline">
        Back to sign in
      </a>
    </main>
  );
}
