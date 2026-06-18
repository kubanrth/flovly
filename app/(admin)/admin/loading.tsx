import { Skeleton } from "@/components/ui/skeleton";

// Admin dashboard skeleton — hero + 4 stat cards + recent activity list.
// Renders inside (admin)/layout — sidebar + brand header już są w layoucie.
export default function AdminLoading() {
  return (
    <main className="flex-1 px-4 py-6 md:px-10 md:py-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        {/* Hero */}
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-9 w-72 md:h-12" />
          <Skeleton className="h-4 w-1/2 max-w-md" />
        </div>

        {/* Stat cards grid */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-5">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </div>

        {/* Recent activity placeholder */}
        <div className="flex flex-col gap-3">
          <Skeleton className="h-4 w-32" />
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="divide-y divide-border">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3.5">
                  <Skeleton className="h-8 w-8 rounded-lg" />
                  <div className="flex flex-1 flex-col gap-1.5">
                    <Skeleton className="h-3.5 w-3/5" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                  <Skeleton className="h-3 w-16" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
