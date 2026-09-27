import { ImageResponse } from "next/og";

export const alt = "Satark — NDRF Disaster Risk Hub";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const LETTERS = [
  { char: "S", color: "#4285F4" },
  { char: "a", color: "#EA4335" },
  { char: "t", color: "#FBBC05" },
  { char: "a", color: "#34A853" },
  { char: "r", color: "#4285F4" },
  { char: "k", color: "#EA4335" },
];

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#020617",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 140, fontWeight: 700, letterSpacing: -2 }}>
          {LETTERS.map(({ char, color }, i) => (
            <span key={i} style={{ color }}>
              {char}
            </span>
          ))}
        </div>
        <div style={{ display: "flex", marginTop: 24, fontSize: 32, color: "#cbd5e1" }}>
          NDRF Disaster Risk Hub
        </div>
        <div style={{ display: "flex", marginTop: 12, fontSize: 22, color: "#64748b" }}>
          Flash Flood &amp; Landslide Early Warning · Uttarakhand
        </div>
      </div>
    ),
    { ...size },
  );
}
