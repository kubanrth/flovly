import { Skeleton } from "@/components/ui/skeleton";

// Same frame as E1: header, filter bar, 32px table head, 44px rows, footer.
export default function ContactsLoading() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-2.5 px-8 pt-4 max-md:px-4">
        <Skeleton className="h-[30px] w-28" />
        <Skeleton className="h-3 w-24" />
        <span className="flex-1" />
        <Skeleton className="h-8 w-28 rounded-md" />
        <Skeleton className="h-8 w-32 rounded-md" />
      </div>
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-8 pt-3 pb-2.5 max-md:px-4">
        <Skeleton className="h-7 w-[220px] rounded-sm" />
        <Skeleton className="h-7 w-16 rounded-md" />
        <Skeleton className="h-7 w-24 rounded-md" />
      </div>
      <div className="min-h-0 flex-1">
        <div className="h-8 border-b border-border bg-table-header" />
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex h-11 items-center gap-2.5 border-b border-table-grid px-2.5">
            <Skeleton className="size-7 rounded-md" />
            <Skeleton className="h-3.5 w-48" />
            <Skeleton className="ml-auto h-3.5 w-40" />
          </div>
        ))}
      </div>
      <div className="h-8 shrink-0 border-t border-border bg-canvas" />
    </div>
  );
}
