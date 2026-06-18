import Link from "next/link";
import { ArrowLeft, Compass } from "lucide-react";

// Catch-all 404 dla obszaru aplikacji (app). Łapie wszystkie notFound()
// rzucone z server components — task'i, kontakty, deale, board'y, view'y
// itd. Klient: "w różnych losowych momentach pojawia się 404 i trzeba
// przeładować stronę". To było natywne Next.js 404. Teraz friendly page
// z back-link'iem zamiast wymaganego F5.
//
// Mobile v4 (B11 — Error full-screen): radial brand-tint backdrop +
// gradient "404" headline + stacked CTAs, ≥48px tap targets.
export default function AppNotFound() {
  return (
    <main className="relative mx-auto flex min-h-[80dvh] max-w-lg flex-col items-center justify-center gap-5 overflow-hidden px-4 py-12 text-center md:min-h-0 md:py-24">
      {/* Brand-tinted radial glow per Mobile v4 spec (centered behind icon). */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[30%] h-[280px] w-[280px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(122,51,236,0.22),transparent_65%)] blur-3xl"
      />

      {/* Gradient 404 mark — mobile spec calls for a strong typographic anchor. */}
      <div className="relative font-display text-[4.5rem] font-extrabold leading-none tracking-[-0.04em] md:text-[5rem]">
        <span className="text-brand-gradient">404</span>
      </div>

      <Compass size={28} className="relative text-muted-foreground/40" aria-hidden />

      <div className="relative flex flex-col gap-2">
        <h1 className="font-display text-[1.25rem] font-bold leading-[1.15] tracking-[-0.02em] md:text-[1.9rem]">
          Tej strony <span className="text-brand-gradient">już nie ma</span>
        </h1>
        <p className="text-[0.9rem] leading-[1.55] text-muted-foreground md:text-[0.95rem]">
          Link mógł się zestarzeć albo obiekt został usunięty. Zacznij od
          przeglądu workspace&apos;ów i kliknij ten, który Cię interesuje.
        </p>
      </div>

      {/* Stacked on mobile (single-column), inline on desktop — both ≥48px. */}
      <div className="relative flex w-full max-w-[320px] flex-col items-stretch gap-2 md:max-w-none md:flex-row md:flex-wrap md:justify-center">
        <Link
          href="/workspaces"
          className="inline-flex h-12 items-center justify-center gap-1.5 rounded-xl bg-brand-gradient px-5 font-sans text-[0.95rem] font-semibold text-white shadow-brand transition-opacity hover:opacity-90 md:h-10 md:rounded-lg md:text-[0.9rem]"
        >
          <ArrowLeft size={14} /> Wszystkie przestrzenie
        </Link>
        <Link
          href="/profile"
          className="inline-flex h-12 items-center justify-center rounded-xl border border-border bg-card px-5 font-sans text-[0.9rem] font-medium text-foreground transition-colors hover:bg-accent md:h-10 md:rounded-lg md:text-[0.88rem]"
        >
          Twój profil
        </Link>
      </div>
    </main>
  );
}
