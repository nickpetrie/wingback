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
