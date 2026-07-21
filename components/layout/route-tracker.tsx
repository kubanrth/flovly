"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

// F12-K135: śledzi ostatnią "listową" ścieżkę (nie-taskową) w sessionStorage.
// TaskModalShell.close() używa jej jako returnTo — dokąd wrócić po zamknięciu
// drawer'a otwartego przez intercepting route.
//
// Dlaczego nie document.referrer (poprzednie podejście, K106/K119):
// referrer odzwierciedla ostatni PEŁNY document load, nie SPA history.
// User wszedł do appki przez /inbox → klikał po tabelach client-side →
// referrer nadal "/inbox" → każde zamknięcie drawer'a przenosiło do
// powiadomień. Ten tracker aktualizuje się na każdą zmianę pathname.
export const LAST_LIST_PATH_KEY = "flovly:lastListPath";
// F12-K138: scroll pozycja strony listowej — zapisywana NA BIEŻĄCO (nie
// w momencie otwarcia drawer'a, kiedy base-ui zdążył już scroll-lockować
// body i window.scrollY bywa 0/przekłamane).
export const LAST_LIST_SCROLL_KEY = "flovly:lastListScroll";

export function RouteTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const isTaskRoute = /\/t\/[^/]+/.test(pathname);

  useEffect(() => {
    // Pomijamy task routes (/t/<id> — to drawer/pełny widok zadania,
    // nie miejsce do którego chcemy "wracać").
    if (isTaskRoute) return;
    try {
      const qs = searchParams.toString();
      sessionStorage.setItem(
        LAST_LIST_PATH_KEY,
        qs ? `${pathname}?${qs}` : pathname,
      );
      // Świeża strona listowa = zresetuj punkt odniesienia na aktualny scroll.
      sessionStorage.setItem(LAST_LIST_SCROLL_KEY, String(window.scrollY));
    } catch {
      /* sessionStorage off (private mode) — close() ma fallback */
    }
  }, [pathname, searchParams, isTaskRoute]);

  // F12-K138: łap scroll na bieżąco (passive, throttle przez rAF) — tylko
  // gdy user realnie jest na stronie listowej. Gdy drawer otwarty (task
  // route), body jest scroll-locked i scrollY kłamie — nie nadpisujemy.
  useEffect(() => {
    if (isTaskRoute) return;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        try {
          sessionStorage.setItem(LAST_LIST_SCROLL_KEY, String(window.scrollY));
        } catch {
          /* noop */
        }
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [isTaskRoute]);

  return null;
}
