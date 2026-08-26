"use client";
import { usePathname } from "next/navigation";

// Page padding (32px desktop / 16px mobile) for every route except full-bleed
// ones, which manage their own layout: board views, canvases and task pages,
// plus the v5 screens that claim the full height and pin a footer to the fold.
// Those used to cancel this padding with negative margins hand-synced to the
// values below — one padding change away from breaking.
const FULL_BLEED =
  /^(\/w\/[^/]+\/(b|c|t)\/|\/w\/[^/]+$|\/inbox$|\/my-tasks$|\/my\/todo$|\/my\/calendar$|\/vacations$)/;

export function RouteFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (FULL_BLEED.test(pathname)) return <>{children}</>;
  return <div className="px-4 py-3 md:px-8 md:py-4">{children}</div>;
}
