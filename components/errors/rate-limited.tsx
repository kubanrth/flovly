"use client";

import { useEffect, useState } from "react";
import { Hourglass } from "lucide-react";

// 429 — rate limit. Pokazujemy odliczanie do `retryAfterSec` sekund a po
// 0 enable'ujemy "Spróbuj ponownie". Hook setInterval w client component.
export function RateLimited({
  title = "Za dużo zapytań",
  description = "Złap oddech — system chwilę odpoczywa po serii akcji.",
  retryAfterSec = 30,
  onRetry,
}: {
  title?: string;
  description?: string;
  retryAfterSec?: number;
  onRetry?: () => void;
}) {
  // Anchor wall-clock end-time per `retryAfterSec` change — when prop zmienia
  // się, useState init reads the NEW value via key. Wewnątrz tylko tick co
  // sekundę (clamp do 0), bez setState-in-effect-from-prop.
  const [endsAt] = useState(() => Date.now() + retryAfterSec * 1000);
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)),
  );

  useEffect(() => {
    if (remaining <= 0) return;
    const i = setInterval(() => {
      setRemaining(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
    }, 1000);
    return () => clearInterval(i);
  }, [endsAt, remaining]);

  const canRetry = remaining <= 0;

  return (
    <div className="relative mx-auto flex min-h-[50dvh] max-w-md flex-col items-center justify-center gap-5 overflow-hidden px-4 py-12 text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[28%] h-[240px] w-[240px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(52,190,248,0.22),transparent_65%)] blur-3xl"
      />
      <div className="relative grid h-16 w-16 place-items-center rounded-[19px] border border-sky-500/30 bg-sky-500/10">
        <Hourglass size={28} strokeWidth={1.75} className="text-sky-500" aria-hidden />
      </div>
      <div className="relative flex flex-col gap-2">
        <h2 className="font-mono text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-sky-500">
          429 · rate limited
        </h2>
        <h1 className="font-display text-[1.25rem] font-bold leading-[1.15] tracking-[-0.02em] md:text-[1.5rem]">
          {title}
        </h1>
        <p className="text-[0.9rem] leading-[1.55] text-muted-foreground">
          {description}
        </p>
        {!canRetry && (
          <p className="mt-1 font-mono text-[0.78rem] text-muted-foreground/80">
            Spróbuj ponownie za <span className="font-bold text-foreground">{remaining}s</span>
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={onRetry}
        disabled={!canRetry}
        className="relative inline-flex h-12 items-center justify-center gap-1.5 rounded-xl bg-brand-gradient px-5 font-sans text-[0.95rem] font-semibold text-white shadow-brand transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 md:h-10 md:rounded-lg md:text-[0.9rem]"
      >
        {canRetry ? "Spróbuj ponownie" : `Odczekaj · ${remaining}s`}
      </button>
    </div>
  );
}
