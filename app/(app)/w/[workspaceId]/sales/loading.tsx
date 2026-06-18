import { AppShell } from "@/components/layout/app-shell";
import { Skeleton } from "@/components/ui/skeleton";

// Sales pipeline skeleton — header + kanban-style stage columns (~5 columns).
export default function SalesLoading() {
  return (
    <AppShell>
      <div className="flex flex-col gap-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-9 w-72 md:h-12" />
            <Skeleton className="h-4 w-48" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-28 rounded-lg" />
            <Skeleton className="h-9 w-32 rounded-lg" />
          </div>
        </div>

        {/* Stage columns — kanban-style */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, col) => (
            <div key={col} className="flex flex-col gap-2 rounded-2xl border border-border bg-card/60 p-3 backdrop-blur-xl">
              <div className="flex items-center justify-between gap-2 px-1">
                <Skeleton className="h-3.5 w-20" />
                <Skeleton className="h-4 w-6 rounded-full" />
              </div>
              <div className="flex flex-col gap-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <DealCardSkeleton key={i} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}

function DealCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-md border border-border bg-background p-3">
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-3 w-3/4" />
        <Skeleton className="h-3 w-2/5" />
      </div>
    </div>
  );
}
