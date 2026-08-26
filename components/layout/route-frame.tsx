"use client";
import { usePathname } from "next/navigation";

// Page padding (32px desktop / 16px mobile) for every route except full-bleed
// ones (board views, canvases, task pages) which manage their own layout.
const FULL_BLEED = /^\/w\/[^/]+\/(b|c|t)\//;

export function RouteFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (FULL_BLEED.test(pathname)) return <>{children}</>;
  return <div className="px-4 py-3 md:px-8 md:py-4">{children}</div>;
}
