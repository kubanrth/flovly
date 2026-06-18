"use client";

import { useEffect, useState } from "react";

/**
 * B6 CRM mobile · Contact card sticky tabs
 *
 * Spec: "sticky tabs (Info / Deale / Aktywność / Notatki) jako horizontal
 * scrollable pills, content scrollable".
 *
 * Implementacja: anchor-link tabs które scrollują do `#info`, `#deals`,
 * `#activity`, `#messages` na stronie. Active tab tracker używa IntersectionObserver
 * żeby aktywny pill zmieniał się gdy user manualnie scrolluje.
 *
 * Sticky-top: `position: sticky` z `top` ustawionym na wysokość mobile
 * AppShell header'a. Backdrop blur dla layered look.
 */

interface Tab {
  id: string;
  label: string;
}

// Kolejność = kolejność sekcji w karcie kontaktu (pipeline → konwersacja →
// zadania → timeline aktywności → form/info). Pierwszy tab dostaje active
// state przy initial render.
const TABS: Tab[] = [
  { id: "contact-deals", label: "Deale" },
  { id: "contact-messages", label: "Wiadomości" },
  { id: "contact-tasks", label: "Zadania" },
  { id: "contact-activity", label: "Aktywność" },
  { id: "contact-info", label: "Info" },
];

export function ContactMobileTabs() {
  const [activeId, setActiveId] = useState<string>(TABS[0]!.id);

  useEffect(() => {
    // Spy na sections — pierwszy widoczny dostaje active state. rootMargin
    // odpycha "active" w dół żeby user widział section dopiero gdy faktycznie
    // jest na środku ekranu, nie tuż pod tabbarem.
    const elements: HTMLElement[] = [];
    for (const t of TABS) {
      const el = document.getElementById(t.id);
      if (el) elements.push(el);
    }
    if (elements.length === 0) return;

    const io = new IntersectionObserver(
      (entries) => {
        // Najpierw bierzemy intersecting entries z największym intersection ratio.
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      {
        rootMargin: "-30% 0% -50% 0%",
        threshold: [0, 0.25, 0.5, 0.75, 1],
      },
    );
    for (const el of elements) io.observe(el);
    return () => io.disconnect();
  }, []);

  const onClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    // scroll-margin-top jest ustawiony na sekcjach przez Tailwind `scroll-mt-X`
    // (poniżej w detail page). smooth scroll dla wrażenia że tabs są łączem.
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveId(id);
  };

  return (
    <nav
      aria-label="Sekcje kontaktu"
      // Sticky pod mobile AppShell header'em (≈56px). Top wartość iteracyjna —
      // 14 = 56px (h-14). Wyłącz na md+.
      className="sticky top-14 z-20 -mx-4 border-b border-border bg-background/90 backdrop-blur-md md:hidden"
    >
      <div className="flex gap-1.5 overflow-x-auto px-4 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TABS.map((t) => {
          const active = t.id === activeId;
          return (
            <a
              key={t.id}
              href={`#${t.id}`}
              onClick={(e) => onClick(e, t.id)}
              aria-current={active ? "true" : undefined}
              className="shrink-0 whitespace-nowrap rounded-full border border-border bg-card px-3.5 py-2 font-mono text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground transition-colors data-[on=true]:border-primary data-[on=true]:bg-primary/10 data-[on=true]:text-foreground"
              data-on={active ? "true" : "false"}
            >
              {t.label}
            </a>
          );
        })}
      </div>
    </nav>
  );
}
