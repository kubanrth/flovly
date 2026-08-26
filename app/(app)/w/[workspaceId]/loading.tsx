import { Skeleton } from "@/components/ui/skeleton";

// Mirrors page.tsx (C1): header + tabs, 3-column board cards, footer strip.
export default function WorkspaceLoading() {
  return (
    <div className="flex h-[calc(100dvh-var(--topbar))] flex-col bg-card">
      <div className="flex-none border-b border-border pt-4">
        <div className="flex items-center gap-3 px-8 max-md:px-4">
          <Skeleton className="size-10 rounded-lg" />
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-3 w-64" />
          </div>
        </div>
        <div className="flex h-10 items-center gap-4 px-8 max-md:px-4">
          <Skeleton className="h-3 w-14" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      <div className="min-h-0 flex-1 bg-canvas px-8 py-5 max-md:px-4">
        <div className="grid grid-cols-3 gap-3 max-lg:grid-cols-2 max-md:grid-cols-1">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-[150px] rounded-lg" />
          ))}
        </div>
      </div>
      <div className="h-8 shrink-0 border-t border-border bg-canvas" />
    </div>
  );
}
