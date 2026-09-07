import type { ReactNode } from "react";

// Gentle cross-fade for board view content on tab switch. Plays on mount —
// switching tabs mounts a different page, so no key is needed here; the only
// same-component switch (custom view → custom view on v/[viewId]) passes
// `key={viewId}` from the page.
//
// It used to be keyed on `usePathname()`. That remounted the whole view every
// time the task panel opened or closed (pathname flips between /b/…/table and
// /t/<id> while the list stays on screen) — the list vanished and faded back
// in, which read as a page reload, and scroll position had to be restored by
// hand in TaskModalShell.
//
// IMPORTANT: this MUST NOT use tw-animate-css'owe `animate-in`/`fade-in-0`.
// Te keyframe'y inline'ują transform: translate3d(0,0,0) jako część custom-
// properties pipeline'u — nawet pure-opacity fade kończy się z perzystującym
// transformem (animation-fill-mode: both). Ten transform tworzy containing
// block dla descendants → łamie dnd-kit DragOverlay positioning w kanbanie
// (karta przy drag'u wyskakiwała w prawo od kursora), `position: fixed`
// w popupach (popraviono wcześniej portal'em), i scroll-restore w drawer'ach.
//
// Implementacja: inline @keyframes na sam opacity, BEZ transform. Pure CSS,
// brak dotykania ancestor coord space'a.
export function ViewTransition({ children }: { children: ReactNode }) {
  return (
    <>
      <style>{`
        @keyframes view-transition-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-view-transition] {
            animation: none !important;
            opacity: 1 !important;
          }
        }
      `}</style>
      <div
        data-view-transition=""
        style={{ animation: "view-transition-fade-in 200ms ease-out both" }}
        className="flex min-h-0 flex-1 flex-col gap-4 md:gap-6"
      >
        {children}
      </div>
    </>
  );
}
