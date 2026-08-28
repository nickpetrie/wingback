import { SkelBlock, SkelLine, SkelOthers } from "./Skeleton";

/** Home's loading state, laid out in the shape of the real page — the pick
 * block on the left, the other four on the right, the fixture list below —
 * so nothing moves when the content arrives. It must never resemble the
 * signed-out screen: "am I still logged in?" is exactly the question someone
 * is asking while they look at this. */
export default function Loading() {
  return (
    <main className="wb-page" style={{ padding: "20px 24px 64px" }} aria-busy="true">
      <span className="sr-only">Loading</span>

      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
          borderBottom: "2px solid var(--color-divider)",
          paddingBottom: 12,
        }}
      >
        <SkelBlock width={170} height={26} />
        <SkelBlock width={110} height={13} delay={2} />
      </div>

      <div className="wb-home-split">
        <section className="wb-home-split-left">
          <SkelLine width={72} height={11} />
          <div style={{ display: "flex", gap: 14, alignItems: "stretch", marginTop: 14 }}>
            <SkelBlock width={126} aspectRatio="4 / 5" />
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
              <SkelLine width="70%" height={24} delay={2} />
              <SkelLine width="45%" height={12} delay={3} />
              <div style={{ marginTop: "auto", display: "flex", gap: 8 }}>
                <SkelBlock width={64} height={30} />
                <SkelBlock width={92} height={30} delay={2} />
              </div>
            </div>
          </div>
        </section>

        <section className="wb-home-split-right">
          <SkelLine width={90} height={11} />
          <div style={{ marginTop: 14 }}>
            <SkelOthers />
          </div>
        </section>
      </div>

      <div style={{ padding: "18px 0" }}>
        <div style={{ borderBottom: "2px solid var(--color-divider)", paddingBottom: 10 }}>
          <SkelLine width={180} height={13} />
        </div>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 0",
              borderBottom: "1px solid var(--color-divider)",
            }}
          >
            <SkelBlock width={40} height={11} />
            <SkelBlock width={150} height={14} delay={2} />
          </div>
        ))}
      </div>
    </main>
  );
}
