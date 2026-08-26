"use client";

// Lazy-loaded CanvasEditor wrapper.
//
// The real editor pulls in @xyflow/react (~4.6 MB in node_modules) and
// yjs (~2.5 MB) + Supabase Realtime — ~7 MB of source weight that only
// the /c/[canvasId] route actually needs. Dynamic import with
// ssr: false keeps the heavy JS out of:
//   * the initial document render (faster FCP on the canvas page)
//   * any other route's bundle (Next route-splitting handles the
//     cross-route case but this guards against accidental imports).
//
// Bundle-analyzer note: confirm the `canvas-editor` chunk is separated
// after `ANALYZE=true npm run build`.

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type { CanvasEditor as CanvasEditorType } from "@/components/canvas/canvas-editor";

export type CanvasEditorProps = ComponentProps<typeof CanvasEditorType>;

const Impl = dynamic(
  () => import("@/components/canvas/canvas-editor").then((m) => m.CanvasEditor),
  {
    ssr: false,
    loading: () => <CanvasLoadingSkeleton />,
  },
);

export function CanvasEditorLazy(props: CanvasEditorProps) {
  return <Impl {...props} />;
}

function CanvasLoadingSkeleton() {
  return (
    <div className="grid h-full w-full place-items-center bg-canvas">
      <div className="flex flex-col items-center gap-3">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-n-200 border-t-orange-500 motion-reduce:animate-none" />
        <span className="text-xs text-muted-foreground">Ładuję edytor…</span>
      </div>
    </div>
  );
}
