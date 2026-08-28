// Shown while a page (and, on a cold start, the session behind it) is still
// resolving. Deliberately just the wordmark on the page background: the one
// thing it must never do is look like the signed-out screen, since "am I
// logged in?" is exactly the question the reader is asking while they look
// at it.
export default function Loading() {
  return (
    <main
      className="wb-page"
      style={{
        padding: "64px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "40vh",
      }}
      aria-busy="true"
    >
      <span
        style={{
          fontFamily: "var(--font-heading)",
          fontWeight: 800,
          fontSize: 20,
          letterSpacing: "-.02em",
          color: "color-mix(in srgb, var(--color-accent) 55%, transparent)",
        }}
      >
        WINGBACK
      </span>
      <span className="sr-only">Loading</span>
    </main>
  );
}
