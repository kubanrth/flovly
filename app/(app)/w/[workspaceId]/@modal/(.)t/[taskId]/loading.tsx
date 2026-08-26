// Instant skeleton for the intercepting task panel (AK63: panel visible < 400ms
// while fetchTaskDetail streams). Same geometry as TaskModalShell's panel.
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";

export default function TaskModalLoading() {
  return (
    <Sheet open modal={false}>
      <SheetContent side="right" modal={false} showCloseButton={false} data-ui="task-panel-loading" className="top-0! md:top-(--topbar)! md:h-auto" initialFocus={undefined}>
        <SheetTitle className="sr-only">Ładowanie zadania</SheetTitle>
        <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-3">
          <Skeleton className="h-4 w-10" />
          <Skeleton className="h-[26px] w-20" />
          <Skeleton className="h-[26px] w-16" />
          <span className="flex-1" />
          {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="size-7" />)}
        </div>
        <div className="flex min-h-0 flex-1">
          <div className="flex min-w-0 flex-1 flex-col gap-4 p-4">
            <Skeleton className="h-6 w-4/5" />
            <Skeleton className="h-6 w-2/5" />
            <Skeleton className="mt-2 h-3 w-12" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="mt-2 h-3 w-24" />
            <Skeleton className="h-7 w-3/4" />
            <Skeleton className="h-7 w-2/3" />
          </div>
          <div className="flex w-[204px] shrink-0 flex-col gap-3 border-l border-n-100 p-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="flex flex-col gap-1.5">
                <Skeleton className="h-3 w-14" />
                <Skeleton className="h-5 w-24" />
              </div>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
