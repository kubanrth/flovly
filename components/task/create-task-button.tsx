"use client";

import { useActionState, useEffect, useState, startTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AlertCircle, ArrowUp, ChevronDown, Minus, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import {
  createTaskAction,
  type CreateTaskState,
} from "@/app/(app)/w/[workspaceId]/t/actions";
import {
  PRIORITY_META,
  type TaskPriorityValue,
} from "@/lib/task-priority";
import type { ShellBoard } from "@/components/layout/shell-types";

// Lokalna kolejność ikon dla priority pickera. Identyczne meta jak w
// PriorityBadge, ale tutaj renderujemy jako wybór (radio-like pills).
const PRIORITY_PICK_OPTIONS: {
  value: TaskPriorityValue;
  Icon: typeof Plus;
}[] = [
  { value: "URGENT", Icon: AlertCircle },
  { value: "HIGH", Icon: ArrowUp },
  { value: "MEDIUM", Icon: Minus },
  { value: "LOW", Icon: ChevronDown },
];

export function CreateTaskButton({
  workspaceId,
  boardId,
  viewId,
}: {
  workspaceId: string;
  boardId: string;
  // F12-K131: jeśli set, nowy task auto-przypisany do tego custom view'a
  // (via TaskView join). Named views (Problemy/Bugi/etc.) używają — task
  // pokazuje się TYLKO w tym view. Default view (/table) nie podaje.
  viewId?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-4 font-sans text-[0.88rem] font-semibold text-white transition-[transform,opacity] duration-200 hover:-translate-y-[1px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <Plus size={14} /> Nowe zadanie
      </button>
      <CreateTaskDialog workspaceId={workspaceId} boardId={boardId} viewId={viewId} open={open} onOpenChange={setOpen} />
    </>
  );
}

export interface CreateTaskDialogProps {
  workspaceId: string;
  // Brak boardId (np. z top-bar „Utwórz" poza tablicą) → pole „Tablica" z `boards`.
  boardId?: string;
  boards?: ShellBoard[];
  viewId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateTaskDialog({ workspaceId, boardId, boards = [], viewId, open, onOpenChange }: CreateTaskDialogProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [pickedBoard, setPickedBoard] = useState<string | null>(null);
  const board = boardId ?? pickedBoard;
  const wsId = boards.find((b) => b.id === board)?.workspaceId ?? workspaceId;
  // F12-K75: state w komponencie, bo radio input nie zachowuje wartości
  // przy controlled form. Default "NONE" — większość tasków nie wymaga priorytetu.
  const [priority, setPriority] = useState<TaskPriorityValue>("NONE");
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
  // Reset priority gdy modal otwierany ponownie po wcześniejszym sukcesie.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!open) setPriority("NONE");
  }, [open]);

  useEffect(() => {
    if (state?.ok) {
      onOpenChange(false);
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
      router.push(`/w/${wsId}/t/${state.taskId}`, { scroll: false });
      // Bez router.refresh() — revalidatePath w createTaskAction już
      // odświeżył route segment, dodatkowy refresh tylko sypał race condition
      // z scroll-lock'iem dialogu.
    }
  }, [state, router, wsId, pathname, onOpenChange]);

  const fieldError = !state?.ok ? state?.fieldErrors?.title : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Mobile: full-screen bottom sheet (spec v4 linie 132-152) — Dialog
          renderowany na całą wysokość 100dvh, sticky submit przyklejony
          do dołu z safe-area-inset-bottom. Desktop: bez zmian. */}
      <DialogContent data-ui="create-task-dialog" className="dialog-surface flex max-h-[100dvh] flex-col gap-0 overflow-hidden border-transparent max-md:!inset-x-0 max-md:!bottom-0 max-md:!top-auto max-md:!left-0 max-md:h-[100dvh] max-md:w-screen max-md:max-w-none max-md:!translate-x-0 max-md:!translate-y-0 max-md:rounded-t-[24px] max-md:rounded-b-none md:max-h-none md:rounded-2xl md:sm:max-w-[520px]">
        <DialogHeader className="shrink-0 border-b-0 max-md:px-1 max-md:pt-2">
          {/* Mobile drag handle visual cue */}
          <div className="sheet-drag-handle md:hidden" aria-hidden="true" />
          <span className="eyebrow">Nowe zadanie</span>
          <DialogTitle className="font-display text-[1.5rem] font-bold leading-[1.15] tracking-[-0.02em] text-foreground">
            Co trzeba <span className="">zrobić?</span>
          </DialogTitle>
          <DialogDescription className="text-[0.92rem] leading-[1.55] text-muted-foreground">
            Szczegóły uzupełnisz po utworzeniu — otworzymy kartę zadania od razu.
          </DialogDescription>
        </DialogHeader>

        <form
          action={(fd) => startTransition(() => formAction(fd))}
          className="mt-2 flex min-h-0 flex-1 flex-col gap-6 px-5 pb-5 max-md:overflow-y-auto"
        >
          <input type="hidden" name="workspaceId" value={wsId} />
          <input type="hidden" name="boardId" value={board ?? ""} />
          {/* F12-K131: viewId → auto-assign do custom view via TaskView join. */}
          {viewId && <input type="hidden" name="viewId" value={viewId} />}
          {/* F12-K75: priority kontrolowany przez state, hidden field
              spina go z form data (server odbiera w createTaskAction). */}
          <input type="hidden" name="priority" value={priority} />

          {!boardId && (
            <label className="flex flex-col gap-2">
              <span className="eyebrow">Tablica</span>
              <Select
                aria-label="Tablica"
                placeholder="Wybierz tablicę…"
                value={pickedBoard}
                onValueChange={setPickedBoard}
                items={boards.map((b) => ({ value: b.id, label: `${b.workspaceName} / ${b.name}` }))}
              />
            </label>
          )}

          <label className="flex flex-col gap-2">
            <span className="eyebrow">Tytuł</span>
            <span className="block">
              <input
                name="title"
                type="text"
                required
                autoFocus
                maxLength={2000}
                placeholder="np. Zaprojektować logo FLOVLY"
                aria-invalid={!!fieldError}
                className="h-10 w-full border-b border-border bg-transparent pb-1 pr-6 text-[1rem] outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40 aria-[invalid=true]:border-destructive"
              />
            </span>
            {fieldError && (
              <span className="font-mono text-[0.68rem] text-destructive">
                {fieldError}
              </span>
            )}
          </label>

          {/* F12-K75: priority picker — 4 pills (URGENT/HIGH/MEDIUM/LOW)
              + "wyczyść". Brak priorytetu jest aktywny gdy nic nie wybrane. */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="eyebrow">Priorytet</span>
              {priority !== "NONE" && (
                <button
                  type="button"
                  onClick={() => setPriority("NONE")}
                  className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
                >
                  Wyczyść
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {PRIORITY_PICK_OPTIONS.map(({ value, Icon }) => {
                const meta = PRIORITY_META[value];
                const on = priority === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setPriority(value)}
                    data-on={on ? "true" : "false"}
                    className={`group inline-flex h-10 items-center gap-2 rounded-lg border bg-background px-3 font-sans text-[0.84rem] transition-[transform,border-color,background-color,color] hover:-translate-y-px ${
                      on
                        ? `${meta.border} ${meta.bg} ${meta.color}`
                        : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                    }`}
                  >
                    <Icon size={14} />
                    <span className="font-medium">{meta.label}</span>
                    <span
                      className={`ml-auto font-mono text-[0.6rem] uppercase tracking-[0.1em] ${on ? "" : "text-muted-foreground/60"}`}
                    >
                      {meta.shortCode}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Mobile: sticky bottom footer z brand gradient submit + safe-area.
              Desktop: inline justify-end. mt-auto na mobile pcha footer na sam dół
              gdy formularz jest krótki. */}
          <div className="mt-2 flex items-center justify-end gap-3 max-md:mt-auto max-md:-mx-6 max-md:flex-col-reverse max-md:items-stretch max-md:gap-2 max-md:border-t max-md:border-border/60 max-md:bg-card/95 max-md:px-6 max-md:pt-3 max-md:pb-safe-bottom max-md:">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="font-mono text-[0.72rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground max-md:min-h-[44px] max-md:text-[0.8rem]"
            >
              Anuluj
            </button>
            <button
              type="submit"
              disabled={pending || !board}
              className="inline-flex h-11 items-center justify-center rounded-lg bg-primary px-6 font-sans text-[0.9rem] font-semibold text-white transition-[transform,opacity] duration-200 hover:-translate-y-[1px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60 max-md:min-h-[48px] max-md:w-full max-md:text-[0.95rem]"
            >
              {pending ? "Tworzę…" : "Utwórz zadanie"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
