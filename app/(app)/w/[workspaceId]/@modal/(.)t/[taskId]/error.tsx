"use client";

// F12-K105: error boundary dla intercepting task modal route.
// Bez tego runtime error w fetchTaskDetail / TaskDetail render = white screen.
// User raportował "zadania z priorytetem nie otwierają się" — jeśli SSR fetch
// rzucił błąd (np. corrupted data, missing FK), bez error.tsx Next.js
// fallback do parent error.tsx który nie renderuje w modal kontekście.

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { AlertTriangle, X, RotateCcw } from "lucide-react";

export default function TaskModalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  // Log do Sentry / console
  useEffect(() => {
    console.error("[TaskModal] render failed:", error);
  }, [error]);

  const close = () => router.back();

  return (
    <BaseDialog.Root open onOpenChange={(next) => !next && close()}>
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className="fixed inset-0 z-[100] bg-background/70 backdrop-blur-sm data-[open]:opacity-100" />
        <BaseDialog.Popup
          className="fixed inset-y-0 right-0 z-[110] flex w-full max-w-[860px] flex-col overflow-y-auto border-l border-border bg-background shadow-[0_18px_40px_-16px_rgba(76,29,149,0.40)] data-[open]:translate-x-0"
          initialFocus={undefined}
        >
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/95 px-4 py-3 sm:px-8">
            <BaseDialog.Title className="eyebrow">Szczegóły zadania</BaseDialog.Title>
            <button
              type="button"
              onClick={close}
              className="grid h-9 w-9 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Zamknij"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-12 text-center">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-rose-500/10 text-rose-500">
              <AlertTriangle size={28} />
            </div>
            <div className="flex flex-col gap-2">
              <h2 className="font-display text-[1.4rem] font-bold leading-tight tracking-[-0.02em]">
                Nie udało się załadować zadania
              </h2>
              <p className="max-w-[36ch] text-[0.92rem] leading-[1.55] text-muted-foreground">
                Wystąpił błąd podczas pobierania danych. Spróbuj ponownie albo
                otwórz zadanie w pełnym widoku.
              </p>
              {error.digest && (
                <p className="font-mono text-[0.7rem] text-muted-foreground/60">
                  ID błędu: {error.digest}
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={reset}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-gradient px-4 font-sans text-[0.86rem] font-semibold text-white shadow-brand transition-[transform,opacity] hover:-translate-y-[1px]"
              >
                <RotateCcw size={14} /> Spróbuj ponownie
              </button>
              <button
                type="button"
                onClick={close}
                className="inline-flex h-10 items-center rounded-xl border border-border bg-card px-4 font-sans text-[0.86rem] font-medium text-foreground transition-colors hover:bg-accent"
              >
                Zamknij
              </button>
            </div>
          </div>
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}
