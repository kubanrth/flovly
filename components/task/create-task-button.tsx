"use client";

import { useActionState, useEffect, useState, startTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createTaskAction,
  type CreateTaskState,
} from "@/app/(app)/w/[workspaceId]/t/actions";

export function CreateTaskButton({
  workspaceId,
  boardId,
}: {
  workspaceId: string;
  boardId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<CreateTaskState, FormData>(
    createTaskAction,
    null,
  );

  // On success — use client navigation so @modal intercepting route activates.
  // returnTo zapisany w sessionStorage żeby modal close wracał do strony skąd
  // user kliknął (table/kanban/etc), nie do workspace overview — bo underlying
  // page intercepted route'a /w/[wid]/t/[tid] to overview.
  // Scoped po taskId: gdyby ten wpis "wisiał" (modal zamknięty nawigacją zamiast
  // X), edycja innego taska go nie skonsumuje i nie skoczy na złą tablicę.
  useEffect(() => {
    if (state?.ok) {
      setOpen(false);
      try {
        sessionStorage.setItem(
          "taskModalReturnTo",
          JSON.stringify({ taskId: state.taskId, path: pathname }),
        );
      } catch {
        // sessionStorage może być wyłączone (private mode safari)
      }
      // scroll: false — base-ui Dialog (TaskModalShell) robi body scroll-lock
      // przy otwarciu. Bez tej flagi Next.js scrollował underlying page do
      // top przy push'u co kolidowało ze scroll-lock'iem → po zamknięciu
      // drawer'a scroll lądował na samym dole tabeli.
      router.push(`/w/${workspaceId}/t/${state.taskId}`, { scroll: false });
      // Bez router.refresh() — revalidatePath w createTaskAction już
      // odświeżył route segment, dodatkowy refresh tylko sypał race condition
      // z scroll-lock'iem dialogu.
    }
  }, [state, router, workspaceId, pathname]);

  const fieldError = !state?.ok ? state?.fieldErrors?.title : undefined;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-brand-gradient px-4 font-sans text-[0.88rem] font-semibold text-white shadow-brand transition-[transform,opacity] duration-200 hover:-translate-y-[1px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <Plus size={14} /> Nowe zadanie
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-xl border-border bg-card sm:max-w-[520px]">
          <DialogHeader>
            <span className="eyebrow">Nowe zadanie</span>
            <DialogTitle className="font-display text-[1.5rem] font-bold leading-[1.15] tracking-[-0.02em] text-foreground">
              Co trzeba <span className="text-brand-gradient">zrobić?</span>
            </DialogTitle>
            <DialogDescription className="text-[0.92rem] leading-[1.55] text-muted-foreground">
              Szczegóły uzupełnisz po utworzeniu — otworzymy kartę zadania od razu.
            </DialogDescription>
          </DialogHeader>

          <form
            action={(fd) => startTransition(() => formAction(fd))}
            className="mt-2 flex flex-col gap-6"
          >
            <input type="hidden" name="workspaceId" value={workspaceId} />
            <input type="hidden" name="boardId" value={boardId} />

            <label className="flex flex-col gap-2">
              <span className="eyebrow">Tytuł</span>
              <input
                name="title"
                type="text"
                required
                autoFocus
                maxLength={2000}
                placeholder="np. Zaprojektować logo FLOVLY"
                aria-invalid={!!fieldError}
                className="h-10 border-b border-border bg-transparent pb-1 text-[1rem] outline-none focus:border-primary aria-[invalid=true]:border-destructive"
              />
              {fieldError && (
                <span className="font-mono text-[0.68rem] text-destructive">
                  {fieldError}
                </span>
              )}
            </label>

            <div className="mt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="font-mono text-[0.72rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
              >
                Anuluj
              </button>
              <button
                type="submit"
                disabled={pending}
                className="inline-flex h-11 items-center justify-center rounded-lg bg-brand-gradient px-6 font-sans text-[0.9rem] font-semibold text-white shadow-brand transition-[transform,opacity] duration-200 hover:-translate-y-[1px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60"
              >
                {pending ? "Tworzę…" : "Utwórz zadanie"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
