export default function AuthErrorPage() {
  return (
    <main style={{ maxWidth: 360, margin: "0 auto", minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center", gap: 12, padding: 24 }}>
      <h1 style={{ margin: 0, fontSize: 25 }}>Sign-in link expired</h1>
      <p style={{ margin: 0, fontSize: 14, color: "color-mix(in srgb, var(--color-text) 60%, transparent)" }}>
        Magic links only work once and expire quickly. Head back and request a new one.
      </p>
      <a href="/login" className="btn btn-ghost wb-tap" style={{ alignSelf: "flex-start", paddingInline: 0 }}>
        Back to sign in
      </a>
    </main>
  );
}
