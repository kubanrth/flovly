import { AppShell } from "@/components/layout/app-shell";
import { Skeleton } from "@/components/ui/skeleton";

// Inbox skeleton — hero (eyebrow + headline + sub) + groupped notification
// rows (Dziś / Wczoraj). Mirror InboxHotkeyList structure.
export default function InboxLoading() {
  return (
    <AppShell>
      <div className="flex flex-col gap-10">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-9 w-2/3 max-w-md md:h-12" />
          <Skeleton className="h-4 w-1/2 max-w-sm" />
        </div>

        <div className="relative overflow-hidden rounded-[22px] border border-white/60 bg-white/55 shadow-[0_30px_70px_-30px_rgba(122,51,236,0.4)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.03]">
          <div className="flex flex-col gap-3 px-4 py-4 md:px-5 md:py-5">
            {/* Group: Dziś */}
            <section>
              <div className="mb-1.5 flex items-center gap-2.5 px-2">
                <Skeleton className="h-4 w-[3px] rounded-[2px]" />
                <Skeleton className="h-3.5 w-16" />
                <Skeleton className="h-4 w-6 rounded-full" />
              </div>
              <ul className="flex flex-col gap-1">
                {Array.from({ length: 3 }).map((_, i) => (
                  <NotificationRowSkeleton key={i} />
                ))}
              </ul>
            </section>
            {/* Group: Wczoraj */}
            <section className="mt-2">
              <div className="mb-1.5 flex items-center gap-2.5 px-2">
                <Skeleton className="h-4 w-[3px] rounded-[2px]" />
                <Skeleton className="h-3.5 w-20" />
                <Skeleton className="h-4 w-6 rounded-full" />
              </div>
              <ul className="flex flex-col gap-1">
                {Array.from({ length: 2 }).map((_, i) => (
                  <NotificationRowSkeleton key={i} />
                ))}
              </ul>
            </section>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function NotificationRowSkeleton() {
  return (
    <li className="flex items-start gap-3 rounded-[13px] px-3.5 py-3">
      <Skeleton className="h-9 w-9 shrink-0 rounded-[10px]" />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <Skeleton className="h-3.5 w-4/5" />
        <Skeleton className="h-3 w-2/3" />
        <Skeleton className="h-2.5 w-20" />
      </div>
    </li>
  );
}
