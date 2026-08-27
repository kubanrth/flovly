import { Skeleton } from "@/components/ui/skeleton";

// Szkielet E7: nagłówek, trzy kafle, pięć kolumn etapów, stopka na fałdzie.
export default function SalesLoading() {
  return (
    <div className="flex min-w-0 flex-1 flex-col" style={{ minHeight: "calc(100dvh - var(--topbar))" }}>
      <div className="flex shrink-0 items-center gap-2.5 px-8 pt-4 max-md:px-4">
        <Skeleton className="h-6 w-44" />
        <span className="flex-1" />
        <Skeleton className="h-7 w-[148px] rounded-md" />
        <Skeleton className="h-8 w-28 rounded-md" />
      </div>
      <div className="flex shrink-0 gap-3 px-8 py-3.5 max-md:px-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-[68px] flex-1 rounded-lg" />
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-hidden bg-canvas px-8 pt-1 max-md:px-4">
        <div className="flex gap-3">
          {Array.from({ length: 5 }).map((_, col) => (
            <div key={col} className="flex w-[264px] shrink-0 flex-col gap-2">
              <Skeleton className="h-4 w-32" />
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-[74px] rounded-lg" />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="h-8 shrink-0 border-t border-border bg-canvas" />
    </div>
  );
}
