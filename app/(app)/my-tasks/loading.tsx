import { Skeleton } from "@/components/ui/skeleton";

// Szkielet D2: nagłówek + segmented, dwie grupy w kontenerach 8px, stopka.
export default function MyTasksLoading() {
  return (
    <div className="flex h-[calc(100dvh-48px)] min-h-0 flex-1 flex-col bg-background">
      <header className="flex flex-none items-center gap-2.5 px-4 pt-4 md:px-8">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-40" />
        <span className="flex-1" />
        <Skeleton className="h-7 w-[260px] rounded-md" />
      </header>
      <div className="min-h-0 flex-1 px-4 pb-6 pt-3 md:px-8">
        <div className="max-w-[960px]">
          {[2, 3].map((count, gi) => (
            <section key={gi} className="mb-3.5">
              <div className="flex h-8 items-center gap-2">
                <Skeleton className="h-3 w-28" />
              </div>
              <div className="overflow-hidden rounded-lg border border-border">
                {Array.from({ length: count }).map((_, i) => (
                  <div key={i} className="flex h-11 items-center gap-2.5 border-b border-n-100 px-3 last:border-b-0">
                    <Skeleton className="size-3.5 rounded-sm" />
                    <Skeleton className="h-3 w-8" />
                    <Skeleton className="h-3.5 flex-1" />
                    <Skeleton className="h-5 w-24 rounded-sm" />
                    <Skeleton className="h-3 w-14" />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
      <div className="h-8 flex-none border-t border-border bg-canvas" />
    </div>
  );
}
