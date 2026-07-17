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

export function RouteTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Pomijamy task routes (/t/<id> — to drawer/pełny widok zadania,
    // nie miejsce do którego chcemy "wracać").
    if (/\/t\/[^/]+/.test(pathname)) return;
    try {
      const qs = searchParams.toString();
      sessionStorage.setItem(
        LAST_LIST_PATH_KEY,
        qs ? `${pathname}?${qs}` : pathname,
      );
    } catch {
      /* sessionStorage off (private mode) — close() ma fallback */
    }
  }, [pathname, searchParams]);

  return null;
}
