import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "FLOVLY";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "FLOVLY";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 40,
          background: "#FFFFFF",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        <svg width="220" height="220" viewBox="0 0 80 80">
          <clipPath id="c">
            <circle cx="40" cy="40" r="40" />
          </clipPath>
          <g clipPath="url(#c)">
            <circle cx="40" cy="40" r="40" fill="#FF5C00" />
            <rect x="50" y="50" width="48" height="48" transform="rotate(45 50 50)" fill="#14110D" />
          </g>
        </svg>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 120, fontWeight: 800, letterSpacing: -4, color: "#14110D" }}>{NAME}</div>
          <div style={{ fontSize: 32, color: "#66625B" }}>System zarządzania projektami</div>
        </div>
      </div>
    ),
    size,
  );
}
