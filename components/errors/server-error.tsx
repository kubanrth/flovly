"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";

// 500 — serwer chwilę nie odpowiada. Optional `onRetry` żeby przy retry
// zrestartowac error boundary. Bez retry pokazujemy hint "odśwież stronę".
export function ServerError({
  title = "Serwer ma chwilę przerwy",
  description = "Spróbuj jeszcze raz za chwilę — większość błędów znika po retry.",
  onRetry,
  digest,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  digest?: string;
}) {
  return (
    <div className="relative mx-auto flex min-h-[50dvh] max-w-md flex-col items-center justify-center gap-5 overflow-hidden px-4 py-12 text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[28%] h-[240px] w-[240px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(244,63,94,0.22),transparent_65%)] blur-3xl"
      />
      <div className="relative grid h-16 w-16 place-items-center rounded-[19px] border border-rose-500/30 bg-rose-500/10">
        <AlertTriangle size={28} strokeWidth={1.75} className="text-rose-500" aria-hidden />
      </div>
      <div className="relative flex flex-col gap-2">
        <h2 className="font-mono text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-rose-500">
          500 · server error
        </h2>
        <h1 className="font-display text-[1.25rem] font-bold leading-[1.15] tracking-[-0.02em] md:text-[1.5rem]">
          {title}
        </h1>
        <p className="text-[0.9rem] leading-[1.55] text-muted-foreground">
          {description}
        </p>
        {digest && (
          <p className="mt-1 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted-foreground/70">
            ref · {digest}
          </p>
        )}
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="relative inline-flex h-12 items-center justify-center gap-1.5 rounded-xl bg-brand-gradient px-5 font-sans text-[0.95rem] font-semibold text-white shadow-brand transition-opacity hover:opacity-90 md:h-10 md:rounded-lg md:text-[0.9rem]"
        >
          <RotateCcw size={14} /> Spróbuj ponownie
        </button>
      )}
    </div>
  );
}
