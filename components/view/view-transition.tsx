"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

// Gentle cross-fade for board view content on tab switch. Keyed on pathname so
// it replays even between two custom views sharing the v/[viewId] route. Pure
// fade (no slide) so it complements the sliding tab indicator instead of
// reading as a "jump". Tab bar lives outside this wrapper and stays put.
export function ViewTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div
      key={pathname}
      className="flex flex-col gap-4 md:gap-6 animate-in fade-in-0 duration-200 ease-out [animation-fill-mode:both] motion-reduce:animate-none"
    >
      {children}
    </div>
  );
}
