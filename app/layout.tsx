import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Onest } from "next/font/google";
import "./globals.css";
import { themeBootScript } from "@/components/layout/theme-toggle";

// F12-K81 (v4 brand polish): match the Flovly v4 design system fonts.
//  - Inter (400/500/600/700) — body/UI sans
//  - JetBrains Mono (500/600) — eyebrows, code, IDs, kbd
//  - Onest (500/600/700/800) — display ladder (text-display-*, h1–h4)
const interSans = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
  weight: ["500", "600"],
});

const onestDisplay = Onest({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
  weight: ["500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "FLOVLY · System Zarządzania Projektami",
  description: "Wewnętrzny system zarządzania projektami.",
  robots: { index: false, follow: false },
};

// viewportFit=cover żeby env(safe-area-inset-*) zwracało prawdziwe wartości
// na iPhonie X+. Bez tego FAB / sticky elements mogłyby nakładać się na
// home indicator / notch area.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pl"
      className={`${interSans.variable} ${jetbrainsMono.variable} ${onestDisplay.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* F11-19: set `dark` class before paint to avoid FOUC. */}
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className="min-h-full flex flex-col text-foreground bg-aura">
        {children}
      </body>
    </html>
  );
}
