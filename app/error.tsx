"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AlertTriangle, RotateCcw, ArrowLeft } from "lucide-react";

// Global error boundary — łapie crashe poza obszarem (app) layout.
// Reuse stylingu z (app)/not-found.tsx (radial brand glow + gradient headline
// + stacked CTAs). reset() restartuje boundary po fix'ie.
//
// W tym pliku NIE używamy AppShell — błąd mógł zostać rzucony z layoutu albo
// providera, więc renderujemy minimal-page bez headera/sidebara.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Logujemy do konsoli żeby digest trafiał do Vercel'owych Server Logs.
    // Sentry/observability TODO oddzielnym sprintem.
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <main className="relative mx-auto flex min-h-[80dvh] max-w-lg flex-col items-center justify-center gap-5 overflow-hidden px-4 py-12 text-center md:min-h-0 md:py-24">
      {/* Brand-tinted radial glow — mirror not-found.tsx aura. */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[30%] h-[280px] w-[280px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(122,51,236,0.22),transparent_65%)] blur-3xl"
      />

      <div className="relative grid h-16 w-16 place-items-center rounded-[19px] border border-[color-mix(in_oklch,var(--brand-500)_25%,transparent)] bg-[color-mix(in_oklch,var(--brand-500)_12%,transparent)]">
        <AlertTriangle size={28} strokeWidth={1.75} className="text-[var(--brand-500)]" aria-hidden />
      </div>

      <div className="relative flex flex-col gap-2">
        <h1 className="font-display text-[1.25rem] font-bold leading-[1.15] tracking-[-0.02em] md:text-[1.9rem]">
          Coś poszło <span className="text-brand-gradient">nie tak</span>
        </h1>
        <p className="text-[0.9rem] leading-[1.55] text-muted-foreground md:text-[0.95rem]">
          Wystąpił nieoczekiwany błąd. Spróbuj jeszcze raz — jeśli problem
          wraca, daj nam znać przez panel wsparcia.
        </p>
        {error.digest && (
          <p className="mt-1 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted-foreground/70">
            ref · {error.digest}
          </p>
        )}
      </div>

      <div className="relative flex w-full max-w-[320px] flex-col items-stretch gap-2 md:max-w-none md:flex-row md:flex-wrap md:justify-center">
        <button
          type="button"
          onClick={() => reset()}
          className="inline-flex h-12 items-center justify-center gap-1.5 rounded-xl bg-brand-gradient px-5 font-sans text-[0.95rem] font-semibold text-white shadow-brand transition-opacity hover:opacity-90 md:h-10 md:rounded-lg md:text-[0.9rem]"
        >
          <RotateCcw size={14} /> Spróbuj ponownie
        </button>
        <Link
          href="/"
          className="inline-flex h-12 items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-5 font-sans text-[0.9rem] font-medium text-foreground transition-colors hover:bg-accent md:h-10 md:rounded-lg md:text-[0.88rem]"
        >
          <ArrowLeft size={14} /> Wróć do strony głównej
        </Link>
      </div>
    </main>
  );
}
