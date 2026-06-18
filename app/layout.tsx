import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { themeBootScript } from "@/components/layout/theme-toggle";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
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
      className={`${geistSans.variable} ${geistMono.variable} ${jakarta.variable} h-full antialiased`}
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
