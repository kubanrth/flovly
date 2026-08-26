import type { ReactNode } from "react";
// Content container for non-board pages. Padding comes from RouteFrame
// (app/(app)/layout.tsx); this only constrains nothing — kept for call sites.
export function AppShell({ children }: { children: ReactNode }) {
  return <div className="flex min-w-0 flex-col">{children}</div>;
}
