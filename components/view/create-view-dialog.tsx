"use client";

import { useActionState, useEffect, useState, startTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Table2,
  KanbanSquare,
  GitBranch,
  BarChart3,
  Calendar,
  Pencil,
  Plus,
  Workflow,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createBoardViewAction,
  type CreateViewState,
} from "@/app/(app)/w/[workspaceId]/b/[boardId]/actions";
import type { ViewName } from "@/components/view/view-switcher";

const TYPE_OPTIONS: {
  value:
    | "TABLE"
    | "KANBAN"
    | "ROADMAP"
    | "GANTT"
    | "CALENDAR"
    | "WHITEBOARD"
    | "TASKLINE";
  name: ViewName;
  label: string;
  icon: typeof Table2;
}[] = [
  { value: "TABLE", name: "table", label: "Tabela", icon: Table2 },
  { value: "KANBAN", name: "kanban", label: "Kanban", icon: KanbanSquare },
  { value: "ROADMAP", name: "roadmap", label: "Roadmapa", icon: GitBranch },
  { value: "GANTT", name: "gantt", label: "Gantt", icon: BarChart3 },
  { value: "CALENDAR", name: "calendar", label: "Kalendarz", icon: Calendar },
  { value: "WHITEBOARD", name: "whiteboard", label: "Whiteboard", icon: Pencil },
  { value: "TASKLINE", name: "taskline", label: "Linia zadań", icon: Workflow },
];

// Compact `+ Nowy widok` button rendered next to the ViewSwitcher.
//
// Two creation modes:
// - If the picked type doesn't yet have a default BoardView on this
//   board (e.g. the user previously deleted the default Kanban),
//   submitting WITHOUT a name recreates that default — the canonical
//   pill (Kanban) reappears and we route to /kanban.
// - If a default already exists, the user must type a name — that
//   creates a custom BoardView under /v/[viewId].
export function CreateViewDialog({
  workspaceId,
  boardId,
  enabled,
  existingDefaultTypes,
}: {
  workspaceId: string;
  boardId: string;
  // All types enabled at the workspace level (independent of which
  // currently have a default row on this board).
  enabled: ViewName[];
  // Types whose default BoardView (name=null) currently exists on this
  // board. Used to decide whether a name is required.
  existingDefaultTypes: ViewName[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<CreateViewState, FormData>(
    createBoardViewAction,
    null,
  );
  const [selectedType, setSelectedType] = useState<string>("TABLE");

  useEffect(() => {
    if (state?.ok) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpen(false);
      router.push(
        state.defaultPath ?? `/w/${workspaceId}/b/${boardId}/v/${state.viewId}`,
      );
      router.refresh();
    }
  }, [state, router, workspaceId, boardId]);

  // Show all 5 view types — server accepts any regardless of workspace.enabledViews.
  // Picking a type not in enabledViews triggers the "recreating default" path.
  void enabled;
  const options = TYPE_OPTIONS;
  // For the picked type: are we recreating a default (no name needed)
  // or creating a custom (name required)?
  const selectedName = TYPE_OPTIONS.find((t) => t.value === selectedType)?.name;
  const recreatingDefault =
    !!selectedName && !existingDefaultTypes.includes(selectedName);
  const selectedLabel = TYPE_OPTIONS.find((t) => t.value === selectedType)?.label ?? "widok";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Nowy widok"
        title="Nowy widok"
        className="lg-vs-add-view"
      >
        <Plus size={12} strokeWidth={2.4} />
        <span>Widok</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen} key={open ? "open" : "closed"}>
        <DialogContent className="dialog-glass rounded-2xl border-transparent sm:max-w-[480px]">
          <DialogHeader>
            <span className="eyebrow">Nowy widok</span>
            <DialogTitle className="font-display text-[1.45rem] font-bold leading-[1.15] tracking-[-0.02em] text-foreground">
              Dodaj <span className="text-brand-gradient">widok</span> do
              tablicy.
            </DialogTitle>
            <DialogDescription className="text-[0.9rem] leading-[1.55] text-muted-foreground">
              Wybierz typ — jeśli dany domyślny widok został wcześniej usunięty,
              możesz go przywrócić. Inaczej dostajesz dodatkowy widok z własną
              nazwą (np. dwa Kanbany z różnymi filtrami).
            </DialogDescription>
          </DialogHeader>

          <form
            action={(fd) => {
              fd.set("workspaceId", workspaceId);
              fd.set("boardId", boardId);
              fd.set("type", selectedType);
              startTransition(() => formAction(fd));
            }}
            className="mt-2 flex flex-col gap-5"
          >
            <div className="flex flex-col gap-2">
              <span className="eyebrow">Typ widoku</span>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {options.map((t) => {
                  const Icon = t.icon;
                  const on = selectedType === t.value;
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setSelectedType(t.value)}
                      data-on={on ? "true" : "false"}
                      className="group flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 font-mono text-[0.72rem] uppercase tracking-[0.12em] text-muted-foreground transition-all data-[on=true]:border-primary/60 data-[on=true]:bg-primary/10 data-[on=true]:text-foreground hover:border-primary/40"
                    >
                      <Icon
                        size={14}
                        className="text-muted-foreground group-data-[on=true]:text-primary"
                      />
                      <span className="flex-1 text-left">{t.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {recreatingDefault ? (
              <p className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-[0.85rem] leading-[1.5] text-foreground">
                Domyślny widok <strong>{selectedLabel}</strong> na tej tablicy
                nie istnieje — kliknij <em>Przywróć</em> aby wrócił jako
                stała pigułka w pasku widoków.
              </p>
            ) : (
              <label className="flex flex-col gap-2">
                <span className="eyebrow">Nazwa widoku</span>
                <input
                  name="name"
                  required
                  autoFocus
                  maxLength={60}
                  placeholder="np. Sprint 4 · Kanban klienta"
                  aria-invalid={!state?.ok && !!state?.fieldErrors?.name}
                  className="h-10 border-b border-border bg-transparent pb-1 font-sans text-[1rem] outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40 aria-[invalid=true]:border-destructive"
                />
                {!state?.ok && state?.fieldErrors?.name && (
                  <span className="font-mono text-[0.68rem] text-destructive">
                    {state.fieldErrors.name}
                  </span>
                )}
              </label>
            )}

            {!state?.ok && state?.error && (
              <p className="font-mono text-[0.72rem] uppercase tracking-[0.14em] text-destructive">
                {state.error}
              </p>
            )}

            <div className="flex items-center justify-end gap-3">
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
                className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-gradient px-5 font-sans text-[0.9rem] font-semibold text-white shadow-brand transition-[transform,opacity] duration-200 hover:-translate-y-[1px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60"
              >
                {pending
                  ? "Tworzę…"
                  : recreatingDefault
                    ? `Przywróć ${selectedLabel}`
                    : "Utwórz widok"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
