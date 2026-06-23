"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { CzesiekPanel } from "./czesiek-panel";

// F12-K96: routes z własnym sticky bottom UI (mobile save bar / action bar) gdzie
// CzesiekFab nakładałby się na klient action. Match przez startsWith po
// /w/<id>/. Desktop nie ma sticky bottom — ale fixed FAB i tak wisi w prawym
// dolnym rogu więc hide też (mniejszy GPU cost przy okazji).
const HIDE_ON_PATTERNS: RegExp[] = [
  /^\/w\/[^/]+\/sales\/[^/]+/, // deal detail (mobile actions: rose-500 X)
  /^\/w\/[^/]+\/wiki(\/|$)/, // wiki editor (mobile save bar)
];

function shouldHideFab(pathname: string | null): boolean {
  if (!pathname) return false;
  return HIDE_ON_PATTERNS.some((re) => re.test(pathname));
}

// F12-K74: Floating action button bottom-right. Pojawia się na każdym
// widoku workspace'u. Klik otwiera Ateron AI panel.
//
// Pozycjonowanie: fixed bottom-right, z odstępem 16px desktop / 12px mobile
// żeby nie zakrywać scrollbar'a. z-index 30 — poniżej Dialog'ów (50) i
// panel'a (50) ale ponad zwykłą treścią.
//
// F12-K88: Na mobile podnosimy FAB do 5rem od dołu (calc(5rem + safe-area))
// żeby NIE zasłaniał sticky footera w task detail drawer (`/w/.../t/[id]`),
// który ma kolejność akcji: Timer + Autosave + Usuń (right). Footer ma
// ~72px wysokości (py-3 + button h-10 + border) — 5rem (80px) daje
// komfortowy gap. Desktop pozostaje na bottom-6 (md:!bottom-6).
//
// Animacja "pulsująca kulka" — 2-warstwowy efekt (F12-K96 perf fix):
//   1. Soft halo (animate-pulse na blur'owanym gradient'cie) — oddychający glow
//   2. Sam button + hover translateY
// PRZED: 3 warstwy z sonar ring (animate-ping + scaling) na fixed bottom-right
// = continuous GPU repaint mounted per workspace page. Klient zgłaszał zamulanie.
// Sonar ring usunięty, halo zostaje z motion-reduce respect.
export function CzesiekFab({ workspaceId }: { workspaceId: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const hidden = shouldHideFab(pathname);

  // F12-K94: signal globally że Ateron panel jest open — globals.css ukrywa
  // mobile sidebar hamburger gdy panel jest open (user myślał że hamburger
  // zamyka chat, ale on otwierał sidebar = zła nawigacja). Cleanup na unmount.
  useEffect(() => {
    if (open) {
      document.body.dataset.czesiekOpen = "true";
    } else {
      delete document.body.dataset.czesiekOpen;
    }
    return () => {
      delete document.body.dataset.czesiekOpen;
    };
  }, [open]);

  // Hide FAB on routes z własnym sticky bottom UI (deal mobile actions,
  // wiki save bar) — żeby nie nakładało się z klient action.
  if (hidden) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Otwórz Aterona"
        title="Ateron AI — twój asystent"
        data-open={open ? "true" : "false"}
        // Mobile: 5rem od dołu (ponad sticky footerem task detail) +
        // safe-area-inset-bottom (iPhone home indicator). Desktop nadpisuje
        // przez md:!bottom-6 (1.5rem).
        style={{
          bottom: "calc(5rem + env(safe-area-inset-bottom, 0px))",
          right: "calc(1rem + env(safe-area-inset-right, 0px))",
        }}
        // F12-K81 (v4 brand polish): square corners per Flovly Components
        // spec (P4 — Ateron AI · FAB 56×56 z rounded-[18px]). Wszystkie
        // 3 warstwy (button + sonar + halo) używają tego samego radius.
        className="fixed z-30 grid h-14 w-14 place-items-center rounded-[18px] bg-brand-gradient text-white shadow-brand transition-[transform,box-shadow,opacity] duration-200 hover:-translate-y-1 hover:shadow-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary data-[open=true]:scale-90 data-[open=true]:opacity-0 md:!bottom-6 md:!right-6 md:h-[58px] md:w-[58px]"
      >
        <span className="font-display text-[1.1rem] font-bold leading-none tracking-[-0.02em]">
          At
        </span>
        {/* Soft halo — pulsująca poświata w miejscu (motion-reduce respect) */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 rounded-[18px] bg-brand-gradient opacity-50 blur-lg animate-pulse motion-reduce:animate-none"
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
