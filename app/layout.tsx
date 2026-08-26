import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// v5: Inter (UI) + JetBrains Mono (IDs, timestamps, kbd). No display font.
const interSans = Inter({
  variable: "--font-sans",
  subsets: ["latin", "latin-ext"],
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin", "latin-ext"],
  display: "swap",
  weight: ["400", "500", "600"],
});

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "FLOVLY";

export const metadata: Metadata = {
  title: `${APP_NAME} · System zarządzania projektami`,
  description: "Wewnętrzny system zarządzania projektami.",
  robots: { index: false, follow: false },
  openGraph: { title: APP_NAME, description: "Wewnętrzny system zarządzania projektami.", siteName: APP_NAME, type: "website" },
  twitter: { card: "summary_large_image", title: APP_NAME, description: "Wewnętrzny system zarządzania projektami." },
};

// F12-K115: client demands zoom lock (behaves like a native app). WCAG 1.4.4
// anti-pattern, acknowledged by the client. viewportFit=cover for safe-area env().
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pl" className={`${interSans.variable} ${jetbrainsMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-foreground">{children}</body>
    </html>
  );
}
