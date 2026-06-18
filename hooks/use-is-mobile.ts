"use client";

import { useEffect, useState } from "react";

// Mobile breakpoint dla bottom-sheet pickerów (v4 mobile spec).
// 767px to ostatni px przed Tailwind `md` (768px) — desktop popovery
// żyją w >=md, sheet w <md. Hook zwraca `false` na SSR żeby uniknąć
// hydration mismatchu — pickery i tak są click-to-open więc pierwszy
// paint na mobile = popover (niewidoczny, bo zamknięty) → po hydration
// flippuje na sheet.
const MOBILE_MEDIA_QUERY = "(max-width: 767px)";

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia(MOBILE_MEDIA_QUERY);
    const handler = () => setIsMobile(mql.matches);
    handler();
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  return isMobile;
}
