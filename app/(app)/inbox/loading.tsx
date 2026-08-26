import { Skeleton } from "@/components/ui/skeleton";

// D1 skeleton — same frame as InboxView: title row, tab strip, grouped cards, footer.
export default function InboxLoading() {
  return (
    <div
      className="flex min-h-0 min-w-0 flex-1 flex-col"
      style={{ minHeight: "calc(100dvh - var(--topbar))" }}
    >
      <div className="flex shrink-0 items-center gap-2.5 px-4 pt-4 md:px-8">
        <Skeleton className="h-[30px] w-56" />
        <span className="flex-1" />
        <Skeleton className="h-7 w-56" />
      </div>
      <div className="flex h-10 shrink-0 items-center gap-4 border-b border-border px-4 md:px-8">
        {[96, 72, 80, 72].map((w) => (
          <Skeleton key={w} className="h-3.5" style={{ width: w }} />
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        <div className="max-w-[860px] px-4 pt-2 pb-6 md:px-8">
          {["Dzisiaj", "Wczoraj"].map((group, gi) => (
            <section key={group} className={gi === 0 ? "" : "mt-2"}>
              <div className="flex h-[30px] items-end">
                <Skeleton className="h-3 w-16" />
              </div>
              <div className="flex flex-col gap-1.5">
                {Array.from({ length: gi === 0 ? 3 : 2 }).map((_, i) => (
                  <div key={i} className="flex gap-2.5 rounded-lg border border-n-100 p-3">
                    <Skeleton className="size-7 shrink-0 rounded-full" />
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <Skeleton className="h-3.5 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
      <div className="flex h-8 shrink-0 items-center border-t border-border bg-canvas px-4 md:px-8">
        <Skeleton className="h-3 w-48" />
      </div>
    </div>
  );
}
