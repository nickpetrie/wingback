import { SkelBlock, SkelLine } from "../Skeleton";
import { LoginHero } from "./LoginHero";

// Deciding whether you are *already* signed in takes a round trip to Supabase's
// auth server, and until it answers this route has nothing to show. Streaming
// the hero straight away turns that wait into the app opening rather than a
// blank screen followed by a page.
export default function LoginLoading() {
  return (
    <main className="wb-login-page" aria-busy="true">
      <span className="sr-only">Loading</span>
      <LoginHero />
      <div className="wb-login-form-panel">
        <div className="wb-login-form-inner wb-login-step">
          <SkelLine width={80} height={19} />
          <SkelLine width="70%" height={14} delay={2} />
          <SkelBlock width="100%" height={44} delay={2} />
          <SkelBlock width={168} height={44} delay={3} />
        </div>
      </div>
    </main>
  );
}
