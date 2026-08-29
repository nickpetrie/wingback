// The green half of the sign-in screen. Split out so `loading.tsx` can paint
// it while the server is still deciding whether you're already signed in —
// the wait then looks like the app opening rather than like nothing happening.

// The five friends this whole app is for — a friendly, familiar touch on
// what would otherwise be a bare email form.
const ENTRANT_FIRST_NAMES = ["Nick", "Tom", "Alex", "Henry", "Casra"];

export function LoginHero() {
  return (
    <div className="wb-login-hero">
      <svg
        className="wb-login-hero-pitch"
        viewBox="0 0 600 600"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <g
          fill="none"
          strokeWidth={2}
          style={{ stroke: "color-mix(in srgb, var(--color-bg) 22%, transparent)" }}
        >
          <circle cx={520} cy={520} r={220} />
          <circle
            cx={520}
            cy={520}
            r={6}
            fill="color-mix(in srgb, var(--color-bg) 22%, transparent)"
          />
          <path d="M 300 600 V 340 a 220 220 0 0 1 220 -220" />
          <circle cx={520} cy={120} r={90} />
        </g>
      </svg>

      <span className="wb-login-wordmark">WINGBACK</span>
      <p className="wb-login-tagline">
        The gang&rsquo;s Premier League goalscorer sweepstake.
      </p>
      <p className="wb-login-names">{ENTRANT_FIRST_NAMES.join(" · ")}</p>
    </div>
  );
}
