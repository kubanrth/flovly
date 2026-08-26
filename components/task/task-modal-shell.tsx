"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useUiPref } from "@/hooks/use-ui-pref";
import { TaskShellContext } from "@/components/task/task-shell-context";

export const PANEL_MIN = 480;
export const PANEL_MAX = 800;

// Intercepting-route task shell (B2). `panel` = 600px right sheet WITHOUT a
// scrim — the list underneath stays interactive (clicking another row swaps
// the task). `modal` = centered 960×760 dialog with scrim (⌘K / notifications).
// Closing navigates back to the originating list + scroll (K135/K138 logic
// kept verbatim below, only the scroll container changed: the v5 shell
// scrolls `[data-ui=main]`, not `window`).
export function TaskModalShell({ taskId, mode = "panel", children }: { taskId: string; mode?: "panel" | "modal"; children: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  // Idempotency guard — close() fired twice per X click (onClick + onOpenChange).
  const closingRef = useRef(false);
  const restoreRef = useRef<{ main: number; win: number } | null>(null);
  useEffect(() => {
    restoreRef.current = { main: mainEl()?.scrollTop ?? 0, win: window.scrollY };
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
        if (parsed?.taskId === taskId && typeof parsed.path === "string") returnTo = parsed.path;
      }
    } catch { /* sessionStorage off or bad JSON — fallback to back */ }
    // F12-K135: fallback = last non-task path from RouteTracker (SPA history, not document.referrer).
    if (!returnTo) {
      try {
        const last = sessionStorage.getItem("flovly:lastListPath");
        if (last && last.startsWith("/") && !last.startsWith("//") && !/\/t\/[A-Za-z0-9_-]+/.test(last)) returnTo = last;
      } catch { /* sessionStorage off — fallback to router.back() */ }
    }
    // F12-K138: window scroll from RouteTracker (kept for legacy window-scrolling pages);
    // `[data-ui=main]` scroll comes from our mount-time ref (no scroll-lock on the non-modal panel).
    const restore = { ...(restoreRef.current ?? { main: 0, win: 0 }) };
    try {
      const n = Number(sessionStorage.getItem("flovly:lastListScroll"));
      if (Number.isFinite(n) && n > 0) restore.win = n;
    } catch { /* noop */ }
    if (returnTo) router.push(returnTo, { scroll: false });
    else router.back();
    // Retry over ~250ms — a single rAF loses the race with the post-revalidate table re-render.
    const apply = () => {
      const main = mainEl();
      if (main && main.scrollTop !== restore.main) main.scrollTop = restore.main;
      if (restore.win) window.scrollTo({ top: restore.win, behavior: "instant" });
    };
    requestAnimationFrame(apply);
    setTimeout(apply, 50);
    setTimeout(apply, 130);
    setTimeout(apply, 250);
  };

  const ctx = { mode, close };
  const onOpenChange = (next: boolean) => { if (!next) close(); };

  if (mode === "modal") {
    return (
      <TaskShellContext.Provider value={ctx}>
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent data-ui="task-modal" showCloseButton={false} initialFocus={false} className="h-[760px] max-h-[calc(100dvh-32px)] sm:max-w-[960px]">
            <DialogTitle className="sr-only">Zadanie</DialogTitle>
            {children}
          </DialogContent>
        </Dialog>
      </TaskShellContext.Provider>
    );
  }

  return (
    <TaskShellContext.Provider value={ctx}>
      <Sheet open={open} onOpenChange={onOpenChange} modal={false} disablePointerDismissal>
        <PanelContent>{children}</PanelContent>
      </Sheet>
    </TaskShellContext.Provider>
  );
}

function PanelContent({ children }: { children: React.ReactNode }) {
  const [width, setWidth] = useUiPref<number>("ui:task-panel-w", 600);
  const w = Math.min(PANEL_MAX, Math.max(PANEL_MIN, width));
  // Drag handle on the left edge: width = viewport right edge − pointer x.
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const move = (ev: PointerEvent) => setWidth(Math.min(PANEL_MAX, Math.max(PANEL_MIN, Math.round(window.innerWidth - ev.clientX))));
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  return (
    <SheetContent
      side="right"
      modal={false}
      showCloseButton={false}
      data-ui="task-panel"
      style={{ "--panel": `${w}px` } as React.CSSProperties}
      className="panel-in top-0! md:top-(--topbar)! md:h-auto"
      initialFocus={false}
    >
      <SheetTitle className="sr-only">Zadanie</SheetTitle>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Zmień szerokość panelu"
        onPointerDown={onPointerDown}
        className="absolute inset-y-0 -left-1 z-10 hidden w-2 cursor-col-resize hover:bg-orange-500/30 md:block"
      />
      {children}
    </SheetContent>
  );
}

function mainEl() {
  return typeof document === "undefined" ? null : document.querySelector<HTMLElement>('[data-ui="main"]');
}
