"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

// iOS-style enter animation for board view content. Keyed on pathname so it
// replays on every tab switch — including between two custom views that share
// the v/[viewId] route (param change wouldn't otherwise remount). The tab bar
// lives outside this wrapper, so it stays put while content fades/slides in.
export function ViewTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div
      key={pathname}
      className="flex flex-col gap-4 md:gap-6 animate-in fade-in-0 slide-in-from-bottom-2 duration-300 ease-out [animation-fill-mode:both] motion-reduce:animate-none"
    >
      {children}
    </div>
  );
}
