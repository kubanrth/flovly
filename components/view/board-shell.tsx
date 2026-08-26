import type { ReactNode } from "react";

// Shared outer shell for every board-level view. Full width of <main>, no
// max-w; `bgCss` (board background) on the container. The header is
// edge-to-edge; every other child gets the 24px view padding.
// ponytail: the child padding selector goes away once each view owns its
// 24px (F2+); then this is just the bg container.
export function BoardShell({
  bgCss,
  children,
}: {
  bgCss: string | null | undefined;
  children: ReactNode;
}) {
  return (
    <div
      className="flex w-full flex-1 flex-col [&>*:not([data-ui=board-header])]:px-6 [&>*:not([data-ui=board-header])]:py-4 max-md:[&>*:not([data-ui=board-header])]:px-4"
      style={bgCss ? { background: bgCss } : undefined}
    >
      {children}
    </div>
  );
}
