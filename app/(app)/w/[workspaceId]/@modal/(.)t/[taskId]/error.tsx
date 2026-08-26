"use client";

// Error boundary for the intercepting task panel — a render/fetch failure must
// not white-screen the list underneath (F12-K105).
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { IconClose, IconUndo, IconWarning } from "@/components/ui/icons";

export default function TaskModalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  useEffect(() => { console.error("[TaskModal] render failed:", error); }, [error]);
  const close = () => router.back();

  return (
    <Sheet open modal={false} onOpenChange={(next) => !next && close()}>
      <SheetContent side="right" modal={false} showCloseButton={false} className="top-0! md:top-(--topbar)! md:h-auto" initialFocus={undefined}>
        <div className="flex h-11 shrink-0 items-center justify-between border-b border-border px-3">
          <SheetTitle className="text-sm font-medium text-muted-foreground">Zadanie</SheetTitle>
          <Button variant="ghost" size="sm" iconOnly aria-label="Zamknij" onClick={close}><IconClose /></Button>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-12 text-center">
          <span className="grid size-9 place-items-center rounded-full bg-chip-red-bg text-danger-text"><IconWarning /></span>
          <div className="flex flex-col gap-1">
            <h2 className="text-md font-semibold">Nie udało się załadować zadania</h2>
            <p className="max-w-[36ch] text-sm text-muted-foreground">Wystąpił błąd podczas pobierania danych. Spróbuj ponownie albo otwórz zadanie w pełnym widoku.</p>
            {error.digest && <p className="font-mono text-2xs text-n-500">ID błędu: {error.digest}</p>}
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={reset}><IconUndo /> Spróbuj ponownie</Button>
            <Button variant="secondary" onClick={close}>Zamknij</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
