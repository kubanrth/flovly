"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";

// Intercepting-route task modal — closing navigates back in history so the intercepted route unmounts naturally.
// sessionStorage 'taskModalReturnTo' lets CreateTaskButton route to the originating page (table/kanban) instead of workspace overview.
// Controlled `open` state: X click closes UI immediately, then navigates (avoids 2-click feel).
export function TaskModalShell({
  taskId,
  children,
}: {
  taskId: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  // Idempotency guard — close() fired twice per X click (onClick + onOpenChange) and second call
  // saw empty sessionStorage so router.back() jumped an extra level.
  const closingRef = useRef(false);

  // Scroll position podłoża zapisana w momencie OTWARCIA drawer'a. base-ui
  // robi scroll-lock body kiedy się otwiera; jego własna restore-logic
  // gubiła pozycję gdy w międzyczasie router.refresh() / revalidatePath
  // przebudował underlying page (np. nowy task w tabeli) → po zamknięciu
  // lądowaliśmy na samym dole. Trzymamy własną wartość i restore'ujemy
  // ręcznie z scroll: false na route push'u.
  const restoreScrollYRef = useRef<number | null>(null);
  useEffect(() => {
    restoreScrollYRef.current = window.scrollY;
  }, []);

  const close = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    setOpen(false);
    let returnTo: string | null = null;
    try {
      const raw = sessionStorage.getItem("taskModalReturnTo");
      sessionStorage.removeItem("taskModalReturnTo");
      if (raw) {
        const parsed = JSON.parse(raw) as { taskId?: string; path?: string };
        if (parsed?.taskId === taskId && typeof parsed.path === "string") {
          returnTo = parsed.path;
        }
      }
    } catch {
      /* sessionStorage off or bad JSON — fallback to back */
    }
    // F12-K106: fallback gdy sessionStorage puste (klient na świeżym cache
    // raportuje że po zamknięciu drawer'a wraca na /workspaces zamiast do
    // tablicy). sessionStorage ustawia się TYLKO w CreateTaskButton po
    // success — gdy user kliknie EXISTING task w tabeli, taskModalReturnTo
    // puste → router.back() w pustej historii (deep link / nowy tab) leci
    // na default workspace overview. document.referrer jest niezawodny.
    if (!returnTo && typeof document !== "undefined") {
      try {
        const ref = document.referrer;
        if (ref) {
          const refUrl = new URL(ref);
          // Same-origin only (security: nie redirect na external referrer).
          if (refUrl.origin === window.location.origin) {
            const refPath = refUrl.pathname + refUrl.search + refUrl.hash;
            // Nie wracaj na ten sam task (refresh) ani na overview workspace
            // (default fallback który był broken).
            if (
              !refPath.includes(`/t/${taskId}`) &&
              refPath !== "/workspaces"
            ) {
              returnTo = refPath;
            }
          }
        }
      } catch {
        /* invalid referrer — fallback to router.back() */
      }
    }
    // scroll: false → Next.js nie resetuje scroll'a na router push;
    // potem requestAnimationFrame przywraca zapamiętaną pozycję ZANIM
    // base-ui zdąży zrobić własny scroll-restore.
    const restoreY = restoreScrollYRef.current ?? 0;
    if (returnTo) {
      router.push(returnTo, { scroll: false });
    } else {
      router.back();
    }
    // Wyłączamy scrollRestoration globalnie na 200ms — wystarczy żeby
    // route push się rozpropagował, potem ustawiamy własne Y.
    requestAnimationFrame(() => {
      window.scrollTo({ top: restoreY, behavior: "instant" });
    });
  };

  return (
    <BaseDialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
      }}
    >
      <BaseDialog.Portal>
        {/* F12-K104: ujednolicone z tokens — backdrop z-[100] (modalBackdrop),
            popup z-[110] (modal). Sidebar hamburger ma z-[80] więc nadal jest
            pod drawerem (klient: "po stworzeniu zadania nie da się go
            zamknąć"). Portalled popovery WEWNĄTRZ drawera muszą używać
            z-[200] (popoverInModal) żeby wyjść nad popup. */}
        <BaseDialog.Backdrop className="fixed inset-0 z-[100] bg-background/70 backdrop-blur-sm data-[closed]:opacity-0 data-[open]:opacity-100" />
        <BaseDialog.Popup
          className="fixed inset-y-0 right-0 z-[110] flex w-full max-w-[860px] flex-col overflow-y-auto border-l border-border bg-background shadow-[0_18px_40px_-16px_rgba(76,29,149,0.40),0_30px_70px_-24px_rgba(124,92,255,0.24)] data-[closed]:translate-x-full data-[open]:translate-x-0 transition-transform duration-200"
          initialFocus={undefined}
        >
          {/* F12-K41: padding sm:px-8 — na mobile (~360-400px szerokości
              drawer = full width) px-8 było za szerokie. */}
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/95 px-4 py-3 backdrop-blur sm:px-8">
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
          <div className="flex-1 px-4 py-6 sm:px-8 sm:py-8">{children}</div>
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}
