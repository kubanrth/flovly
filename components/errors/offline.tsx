"use client";

import { useSyncExternalStore } from "react";
import { WifiOff, RotateCcw } from "lucide-react";

// External store dla navigator.onLine — uniknie setState w useEffect (linter
// żąda useSyncExternalStore dla browser-event subskrypcji).
function subscribeOnline(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}
function getOnlineSnapshot() {
  return navigator.onLine;
}
function getOnlineServerSnapshot() {
  // SSR — zakładamy online żeby komponent nie renderował się bez sensu.
  return true;
}

// Offline — brak połączenia z siecią. Słuchamy `online`/`offline` event'ów
// i automatycznie znikamy z UI (return null) gdy łączność wróci. Dla
// scenariusza network error po fetch'u — call site może wymusić render.
export function Offline({
  title = "Brak połączenia",
  description = "Sprawdź internet i spróbuj ponownie. Większość zmian wczyta się gdy odzyskasz sieć.",
  onRetry,
  forceShow = false,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  forceShow?: boolean;
}) {
  const online = useSyncExternalStore(
    subscribeOnline,
    getOnlineSnapshot,
    getOnlineServerSnapshot,
  );

  if (online && !forceShow) return null;

  return (
    <div className="relative mx-auto flex min-h-[50dvh] max-w-md flex-col items-center justify-center gap-5 overflow-hidden px-4 py-12 text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[28%] h-[240px] w-[240px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(148,163,184,0.22),transparent_65%)] blur-3xl"
      />
      <div className="relative grid h-16 w-16 place-items-center rounded-[19px] border border-slate-500/30 bg-slate-500/10">
        <WifiOff size={28} strokeWidth={1.75} className="text-slate-400" aria-hidden />
      </div>
      <div className="relative flex flex-col gap-2">
        <h2 className="font-mono text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-slate-400">
          offline
        </h2>
        <h1 className="font-display text-[1.25rem] font-bold leading-[1.15] tracking-[-0.02em] md:text-[1.5rem]">
          {title}
        </h1>
        <p className="text-[0.9rem] leading-[1.55] text-muted-foreground">
          {description}
        </p>
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
