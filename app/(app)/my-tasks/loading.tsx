import { AppShell } from "@/components/layout/app-shell";
import { Skeleton } from "@/components/ui/skeleton";

// My Tasks skeleton — hero (eyebrow + headline + sub) + filters bar +
// grouped task rows. Mirror HotkeyTaskList structure (overdue → today → later).
export default function MyTasksLoading() {
  return (
    <AppShell>
      <div className="flex flex-col gap-10">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-9 w-2/3 max-w-md md:h-12" />
          <Skeleton className="h-4 w-1/2 max-w-sm" />
        </div>

        {/* Filters bar */}
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-9 w-64 rounded-lg" />
          <Skeleton className="h-9 w-32 rounded-lg" />
          <Skeleton className="h-9 w-24 rounded-lg" />
        </div>

        <div className="relative overflow-hidden rounded-[22px] border border-white/60 bg-white/55 shadow-[0_30px_70px_-30px_rgba(122,51,236,0.4)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.03]">
          <div className="flex flex-col gap-2 px-4 py-4 md:px-5 md:py-5">
            {/* Section 1: Po terminie */}
            <section>
              <div className="flex items-center gap-2.5 px-2 py-2">
                <Skeleton className="h-4 w-[3px] rounded-[2px]" />
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-4 w-6 rounded-full" />
              </div>
              <ul className="flex flex-col gap-1.5">
                {Array.from({ length: 2 }).map((_, i) => (
                  <TaskRowSkeleton key={i} />
                ))}
              </ul>
            </section>
            {/* Section 2: Dzisiaj */}
            <section className="mt-3">
              <div className="flex items-center gap-2.5 px-2 py-2">
                <Skeleton className="h-4 w-[3px] rounded-[2px]" />
                <Skeleton className="h-3.5 w-20" />
                <Skeleton className="h-4 w-6 rounded-full" />
              </div>
              <ul className="flex flex-col gap-1.5">
                {Array.from({ length: 4 }).map((_, i) => (
                  <TaskRowSkeleton key={i} />
                ))}
              </ul>
            </section>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function TaskRowSkeleton() {
  return (
    <li className="flex items-center gap-3 rounded-[13px] border border-white/60 bg-white/70 px-3.5 py-3 dark:border-white/[0.08] dark:bg-white/[0.04]">
      <Skeleton className="h-3 w-10" />
      <Skeleton className="h-4 flex-1" />
      <Skeleton className="h-6 w-20 rounded-full" />
      <Skeleton className="h-3 w-12" />
    </li>
  );
}
