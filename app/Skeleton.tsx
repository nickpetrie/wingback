/** Shared skeleton pieces. Server components — they render once and never
 * hydrate, since a loading state that ships JavaScript to animate itself is
 * competing for the very main thread it is apologising for. */

export function SkelLine({
  width = "100%",
  height,
  delay,
}: {
  width?: string | number;
  height?: number;
  delay?: 2 | 3;
}) {
  return (
    <span
      className={`wb-skel wb-skel-line${delay ? ` wb-skel-${delay}` : ""}`}
      style={{ display: "block", width, height }}
    />
  );
}

export function SkelBlock({
  width,
  height,
  aspectRatio,
  delay,
}: {
  width?: string | number;
  height?: string | number;
  aspectRatio?: string;
  delay?: 2 | 3;
}) {
  return (
    <span
      className={`wb-skel${delay ? ` wb-skel-${delay}` : ""}`}
      style={{ display: "block", flex: "none", width, height, aspectRatio }}
    />
  );
}

/** The header while Nav is still asking Supabase who you are. Built from the
 * header's own classes (.wb-header, .wb-header-gw, .wb-standing) rather than
 * copied dimensions, so the two are the same height by construction — the
 * icon boxes are literally `.btn-icon`, which is also what makes them 44px
 * under a finger and 36 under a mouse, exactly as the real buttons are. */
export function HeaderSkeleton() {
  return (
    <header className="wb-header" aria-busy="true">
      <div className="wb-page wb-header-bar">
        <div className="wb-header-row">
          <SkelBlock width={112} height={20} />
          <div className="wb-header-actions">
            <span className="wb-skel btn-icon" style={{ display: "block" }} />
            <span className="wb-skel wb-skel-2 btn-icon" style={{ display: "block" }} />
          </div>
        </div>
        <div className="wb-header-gw">
          <SkelBlock width={44} height={23} />
          <SkelBlock width={120} height={13} delay={2} />
        </div>
      </div>
      <div className="wb-header-standings">
        <div className="wb-page wb-standings">
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} className="wb-standing" style={{ cursor: "default" }}>
              <SkelBlock width={14} height={10} />
              <SkelBlock width={24} height={24} delay={i % 2 ? 2 : undefined} />
              <SkelBlock width={48} height={13} />
              <SkelBlock width={22} height={22} delay={3} />
            </span>
          ))}
        </div>
      </div>
    </header>
  );
}

/** The row of four rival picks, in the shape of `.wb-other`. */
export function SkelOthers() {
  return (
    <div className="wb-others">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="wb-other">
          <SkelBlock width={52} aspectRatio="4 / 5" delay={i % 2 ? 2 : undefined} />
          <div className="wb-other-detail" style={{ gap: 6 }}>
            <SkelLine width="45%" height={9} />
            <SkelLine width="80%" height={15} delay={2} />
            <div className="wb-other-foot">
              <SkelLine width={44} height={9} delay={3} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
