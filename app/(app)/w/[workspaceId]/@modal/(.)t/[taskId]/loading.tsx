// F12-K105: loading state dla intercepting task modal route.
// Bez tego user klika task w table/kanban i widzi BLANK (białą stronę) przez
// 1-3s gdy fetchTaskDetail leci (8 paralelnych queries + 1500 candidate
// rows + audit log + Supabase signed URLs dla attachmentów). Skeleton
// pokazuje się natychmiast — perception of speed wzrasta drastycznie.

import { Dialog as BaseDialog } from "@base-ui/react/dialog";

export default function TaskModalLoading() {
  return (
    <BaseDialog.Root open>
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className="fixed inset-0 z-[100] bg-background/70 backdrop-blur-sm data-[open]:opacity-100" />
        <BaseDialog.Popup
          className="fixed inset-y-0 right-0 z-[110] flex w-full max-w-[860px] flex-col overflow-y-auto border-l border-border bg-background shadow-[0_18px_40px_-16px_rgba(76,29,149,0.40),0_30px_70px_-24px_rgba(124,92,255,0.24)] data-[open]:translate-x-0"
          initialFocus={undefined}
        >
          {/* Header skeleton */}
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/95 px-4 py-3 backdrop-blur sm:px-8">
            <span className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground">
              Szczegóły zadania
            </span>
            <div className="h-9 w-9 rounded-md bg-muted/40" />
          </div>

          {/* Body skeleton */}
          <div className="flex-1 px-4 py-6 sm:px-8 sm:py-8">
            <div className="flex flex-col gap-6 animate-pulse">
              {/* Header row: ID + status + priority */}
              <div className="flex items-center gap-2">
                <div className="h-5 w-12 rounded bg-muted/40" />
                <div className="h-6 w-24 rounded-full bg-muted/40" />
                <div className="h-6 w-28 rounded-full bg-muted/40" />
              </div>

              {/* Title */}
              <div className="flex flex-col gap-2">
                <div className="h-8 w-3/4 rounded bg-muted/40" />
                <div className="h-8 w-1/2 rounded bg-muted/40" />
              </div>

              {/* Two-col grid: meta + description */}
              <div className="grid gap-6 md:grid-cols-[1fr_280px]">
                {/* Left: description + comments */}
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <div className="h-3 w-16 rounded bg-muted/40" />
                    <div className="h-24 rounded-lg bg-muted/30" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="h-3 w-20 rounded bg-muted/40" />
                    <div className="h-16 rounded-lg bg-muted/30" />
                    <div className="h-16 rounded-lg bg-muted/30" />
                  </div>
                </div>

                {/* Right: meta sidebar */}
                <div className="flex flex-col gap-4">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="flex flex-col gap-1.5">
                      <div className="h-3 w-12 rounded bg-muted/40" />
                      <div className="h-7 rounded bg-muted/30" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}
