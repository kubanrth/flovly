"use client";

import { useState } from "react";
import { CzesiekPanel } from "./czesiek-panel";

// F12-K74: Floating action button bottom-right. Pojawia się na każdym
// widoku workspace'u. Klik otwiera CzesiekPanel.
//
// Pozycjonowanie: fixed bottom-right, z odstępem 16px desktop / 12px mobile
// żeby nie zakrywać scrollbar'a. z-index 30 — poniżej Dialog'ów (50) i
// CzesiekPanel'a (50) ale ponad zwykłą treścią.
//
// Animacja hover: subtle scale + glow. Brand gradient + Cz emoji-like marker.
export function CzesiekFab({ workspaceId }: { workspaceId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Otwórz Czesieka"
        title="Czesiek AI — twój asystent"
        data-open={open ? "true" : "false"}
        className="fixed bottom-4 right-4 z-30 grid h-14 w-14 place-items-center rounded-full bg-brand-gradient text-white shadow-brand transition-[transform,box-shadow,opacity] duration-200 hover:-translate-y-1 hover:shadow-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary data-[open=true]:scale-90 data-[open=true]:opacity-0 md:bottom-6 md:right-6 md:h-[58px] md:w-[58px]"
      >
        <span className="font-display text-[1.1rem] font-bold leading-none tracking-[-0.02em]">
          Cz
        </span>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 animate-pulse rounded-full bg-brand-gradient opacity-30 blur-md"
        />
      </button>

      <CzesiekPanel
        workspaceId={workspaceId}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
