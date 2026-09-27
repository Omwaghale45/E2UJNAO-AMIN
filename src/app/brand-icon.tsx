// Shared JSX builder for the generated favicon/apple-icon (next/og ImageResponse).
// Not a route file — Next only treats exact reserved filenames (icon.tsx, etc.) as
// special, so this plain helper is safely ignored by the app router.

const QUADRANTS: { color: string; top: 0 | 1; left: 0 | 1 }[] = [
  { color: "#4285F4", top: 0, left: 0 }, // top-left: blue
  { color: "#EA4335", top: 0, left: 1 }, // top-right: red
  { color: "#34A853", top: 1, left: 0 }, // bottom-left: green
  { color: "#FBBC05", top: 1, left: 1 }, // bottom-right: yellow
];

export function BrandIcon({
  size,
  letter = "S",
  background = "#ffffff",
  radius = 0,
}: {
  size: number;
  letter?: string;
  background?: string;
  radius?: number;
}) {
  const half = size / 2;

  return (
    <div
      style={{
        width: size,
        height: size,
        position: "relative",
        display: "flex",
        background,
        borderRadius: radius,
        overflow: "hidden",
      }}
    >
      {QUADRANTS.map(({ color, top, left }) => (
        <div
          key={color}
          style={{
            position: "absolute",
            width: half,
            height: half,
            top: top * half,
            left: left * half,
            display: "flex",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: -top * half,
              left: -left * half,
              width: size,
              height: size,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: size * 0.72,
              fontWeight: 700,
              fontFamily: "sans-serif",
              color,
            }}
          >
            {letter}
          </div>
        </div>
      ))}
    </div>
  );
}
