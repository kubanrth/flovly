import { AppShell } from "@/components/layout/app-shell";
import { Skeleton } from "@/components/ui/skeleton";

// Workspace overview skeleton — mirror page.tsx structure: hero bar
// (eyebrow + headline + meta) + boards grid (3-col cards). Skeleton
// pulse handled by <Skeleton/> primitive (animate-pulse + bg-muted).
export default function WorkspaceLoading() {
  return (
    <AppShell>
      <div className="flex flex-col gap-10">
        {/* Hero bar */}
        <div className="flex flex-col gap-3">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-9 w-3/4 max-w-md md:h-12" />
          <Skeleton className="h-4 w-1/2 max-w-sm" />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Skeleton className="h-9 w-36 rounded-lg" />
            <Skeleton className="h-9 w-28 rounded-lg" />
          </div>
        </div>

        {/* Boards grid placeholder — match SortableBoardsGrid: 1/2/3 cols, ~200px h. */}
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <BoardCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </AppShell>
  );
}

function BoardCardSkeleton() {
  return (
    <div className="relative flex h-[200px] flex-col gap-3.5 overflow-hidden rounded-2xl border border-border/70 bg-card/70 p-5 pl-12 backdrop-blur-xl">
      {/* 3px top accent strip */}
      <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-muted" />
      <div className="flex items-start gap-3">
        <Skeleton className="h-[38px] w-[38px] rounded-xl" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-2.5 w-1/2" />
        </div>
        <Skeleton className="h-6 w-8 rounded-lg" />
      </div>
      <div className="-mx-1 mt-auto flex flex-wrap items-center gap-1.5 px-1 pb-0.5">
        <Skeleton className="h-7 w-16 rounded-lg" />
        <Skeleton className="h-7 w-20 rounded-lg" />
        <Skeleton className="h-7 w-16 rounded-lg" />
      </div>
    </div>
  );
}
