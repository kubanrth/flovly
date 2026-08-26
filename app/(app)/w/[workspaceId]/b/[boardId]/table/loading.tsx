import { Skeleton } from "@/components/ui/skeleton";

// Lista skeleton: header rows + table rows matching final layout heights.
export default function TableLoading() {
  return (
    <div role="status" aria-label="Ładowanie listy">
      <div className="flex flex-col gap-2 px-6 pt-3">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-6 w-64" />
        <div className="mt-1 flex h-10 items-end gap-4 border-b border-border">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="mb-2 h-4 w-16" />
          ))}
        </div>
      </div>
      <div className="flex flex-col">
        <Skeleton className="h-8 w-full rounded-none bg-table-header" />
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-full rounded-none border-b border-table-grid bg-transparent" />
        ))}
      </div>
    </div>
  );
}
