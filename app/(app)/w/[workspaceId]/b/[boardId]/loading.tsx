import { BoardShell } from "@/components/view/board-shell";
import { Skeleton } from "@/components/ui/skeleton";

// Board view skeleton — generic na wszystkie 5 view'ów (table/kanban/roadmap/
// gantt/whiteboard). BoardHeader + view-switcher na górze + duża karta z
// placeholder rows/columns w środku. Konkretne sub-routes (table/kanban/...)
// mogą dodać własny loading.tsx jeśli chcemy bardziej dopasowane skeletony.
export default function BoardLoading() {
  return (
    <BoardShell bgCss={null}>
      {/* Board header skeleton */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-6 w-56" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-24 rounded-lg" />
            <Skeleton className="h-9 w-9 rounded-lg" />
          </div>
        </div>

        {/* View switcher pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-24 rounded-lg" />
          ))}
        </div>
      </div>

      {/* Content surface — table-ish layout with header row + 8 body rows.
          Mirror table view's most common shape; Kanban/Roadmap users will
          see this briefly during nav and it reads as "ładuję dane". */}
      <div className="overflow-hidden rounded-[22px] border border-border bg-card shadow-[0_30px_70px_-30px_rgba(122,92,255,0.4)]">
        {/* Header row */}
        <div className="grid grid-cols-[minmax(0,1fr)_120px_140px_100px_80px] gap-3 border-b border-border bg-card/60 px-4 py-3">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-12" />
        </div>
        {/* Body rows */}
        <div className="divide-y divide-border">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="grid grid-cols-[minmax(0,1fr)_120px_140px_100px_80px] items-center gap-3 px-4 py-3.5"
            >
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-4 w-28" />
              <div className="flex -space-x-1.5">
                <Skeleton className="h-6 w-6 rounded-full" />
                <Skeleton className="h-6 w-6 rounded-full" />
              </div>
              <Skeleton className="h-4 w-12" />
            </div>
          ))}
        </div>
      </div>
    </BoardShell>
  );
}
