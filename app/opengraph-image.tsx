import { ImageResponse } from "next/og";

// F12-K125: open-graph image dla flovly.pl link previews (Telegram, Slack,
// Messenger, FB itp.). Wcześniej brak `openGraph.images` w metadata →
// Telegram/etc. fetch'owały Vercel default OG (czarne tło + biały trójkąt).
// Teraz dynamic-rendered PNG z brand gradient + "FLOVLY" wordmark.

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "FLOVLY — System zarządzania projektami";

export default async function OpenGraphImage() {
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
          background: "linear-gradient(135deg, #1A1325 0%, #2D1B4E 50%, #1A1325 100%)",
          fontFamily: "system-ui, -apple-system, sans-serif",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -200,
            left: -150,
            width: 600,
            height: 600,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(124,92,255,0.45), transparent 60%)",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -180,
            right: -120,
            width: 520,
            height: 520,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(210,71,181,0.35), transparent 60%)",
            display: "flex",
          }}
        />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 24,
            zIndex: 1,
          }}
        >
          <div
            style={{
              width: 130,
              height: 130,
              borderRadius: 28,
              background: "linear-gradient(135deg, #7C5CFF 0%, #D247B5 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 30px 60px -20px rgba(124,92,255,0.6)",
            }}
          >
            <div
              style={{
                color: "#fff",
                fontSize: 88,
                fontWeight: 800,
                letterSpacing: -4,
                lineHeight: 1,
              }}
            >
              F
            </div>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div
              style={{
                color: "#fff",
                fontSize: 110,
                fontWeight: 800,
                letterSpacing: -4,
                lineHeight: 1,
              }}
            >
              FLOVLY
            </div>
            <div
              style={{
                color: "rgba(255,255,255,0.65)",
                fontSize: 28,
                fontWeight: 500,
                letterSpacing: 0,
              }}
            >
              System zarządzania projektami
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    },
  );
}
