import { ImageResponse } from "next/og";

export const alt = "Wingback — Premier League goalscorer sweepstake";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          background: "#201e1d",
          padding: "0 90px",
        }}
      >
        <div style={{ display: "flex", width: 120, height: 10, background: "#1b8a52", marginBottom: 36 }} />
        <div style={{ display: "flex", fontSize: 140, fontWeight: 700, color: "#f3f2f2", letterSpacing: -4 }}>
          WINGBACK
        </div>
        <div style={{ display: "flex", fontSize: 34, color: "#bab6b6", marginTop: 20 }}>
          Premier League goalscorer sweepstake
        </div>
      </div>
    ),
    { ...size },
  );
}
