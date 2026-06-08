"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

// Gentle cross-fade for board view content on tab switch. Keyed on pathname so
// it replays even between two custom views sharing the v/[viewId] route.
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
  const pathname = usePathname();
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
        key={pathname}
        data-view-transition=""
        style={{ animation: "view-transition-fade-in 200ms ease-out both" }}
        className="flex flex-col gap-4 md:gap-6"
      >
        {children}
      </div>
    </>
  );
}
