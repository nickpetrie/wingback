import { SkelBlock, SkelLine } from "../Skeleton";

/** The table's loading state: five rows in the shape of `.wb-board-row`, so
 * the standings land where the skeleton already put them. */
export default function Loading() {
  return (
    <main className="wb-page" style={{ padding: "32px 24px 64px" }} aria-busy="true">
      <span className="sr-only">Loading the table</span>

      <div style={{ borderBottom: "2px solid var(--color-divider)", paddingBottom: 10 }}>
        <SkelBlock width={130} height={24} />
        <div style={{ marginTop: 6 }}>
          <SkelLine width={190} height={11} delay={2} />
        </div>
      </div>

      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="wb-board-row">
          <SkelBlock width={20} height={20} />
          <SkelBlock width={32} height={32} aspectRatio="1" delay={2} />
          <SkelLine width={`${60 - i * 6}%`} height={18} delay={2} />
          <SkelBlock width={26} height={24} delay={3} />
          <span />
          <div className="wb-board-meta" style={{ paddingTop: 4 }}>
            <SkelLine width={110} height={9} delay={3} />
          </div>
        </div>
      ))}
    </main>
  );
}
