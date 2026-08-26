import { Skeleton } from "@/components/ui/skeleton";

// Route-level skeleton for non-board pages (shell renders instantly from layout).
export default function AppLoading() {
  return (
    <div className="flex flex-col gap-4 px-4 py-3 md:px-8 md:py-4" role="status" aria-label="Ładowanie">
      <Skeleton className="h-7 w-56" />
      <Skeleton className="h-4 w-80" />
      <div className="mt-2 flex flex-col gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-11 w-full" />
        ))}
      </div>
    </div>
  );
}
