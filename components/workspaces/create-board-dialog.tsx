"use client";

import { useActionState, useState, startTransition } from "react";
import {
  BarChart3,
  GitBranch,
  KanbanSquare,
  Pencil,
  Plus,
  Table2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createBoardAction,
  type CreateBoardState,
} from "@/app/(app)/w/[workspaceId]/b/actions";

// Same 5 options as the workspace creator — we filter this list down by
// the workspace's own enabledViews before rendering, so you can't pick a
// view that the workspace itself doesn't enable.
const VIEW_PRESETS = [
  { value: "TABLE", label: "Tabela", icon: Table2 },
  { value: "KANBAN", label: "Kanban", icon: KanbanSquare },
  { value: "ROADMAP", label: "Roadmapa", icon: GitBranch },
  { value: "GANTT", label: "Gantt", icon: BarChart3 },
  { value: "WHITEBOARD", label: "Whiteboard", icon: Pencil },
] as const;

// Compact `+` button intended for the sidebar (next to each workspace
// row, gated by role=ADMIN). Opens a dialog with just name + optional
// description; the action seeds columns + BoardView rows.
export function CreateBoardDialog({
  workspaceId,
  size = "sm",
  label,
  workspaceEnabledViews,
}: {
  workspaceId: string;
  size?: "sm" | "md";
  // Optional label — when omitted we render just the "+" glyph (sidebar use).
  label?: string;
  // Parent workspace's enabled views — the new board can only enable a
  // subset of these. If omitted, all 5 defaults are shown.
  workspaceEnabledViews?: Array<"TABLE" | "KANBAN" | "ROADMAP" | "GANTT" | "WHITEBOARD">;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<CreateBoardState, FormData>(
    createBoardAction,
    null,
  );
  const parentEnabled = workspaceEnabledViews ?? ["TABLE", "KANBAN", "ROADMAP", "GANTT", "WHITEBOARD"];
  const [selected, setSelected] = useState<Set<string>>(() => new Set(parentEnabled));
  const toggle = (v: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(v)) next.delete(v);
      else next.add(v);
      return next;
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        aria-label="Nowa tablica"
        title="Nowa tablica"
        className={
          size === "sm"
            ? "grid h-7 w-7 shrink-0 place-items-center rounded-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
            : "inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-3 font-mono text-[0.72rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
        }
      >
        <Plus size={size === "sm" ? 13 : 14} />
        {label && <span>{label}</span>}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-2xl border-border bg-card shadow-aura sm:max-w-[480px]">
          <DialogHeader>
            <span className="eyebrow">Nowa tablica</span>
            <DialogTitle className="font-display text-[1.5rem] font-bold leading-[1.15] tracking-[-0.02em] text-foreground">
              Dodaj kolejny zbiór <span className="text-brand-gradient">danych</span>.
            </DialogTitle>
            <DialogDescription className="text-[0.9rem] leading-[1.55] text-muted-foreground">
              Nowa tablica dostanie te same 4 statusy i widoki co reszta tej
              przestrzeni. Wszystko możesz potem edytować.
            </DialogDescription>
          </DialogHeader>

          <form
            action={(fd) => startTransition(() => formAction(fd))}
            className="mt-2 flex flex-col gap-5"
          >
            <input type="hidden" name="workspaceId" value={workspaceId} />

            <label className="flex flex-col gap-2">
              <span className="eyebrow">Nazwa</span>
              <input
                name="name"
                required
                autoFocus
                maxLength={80}
                placeholder="np. Q2 Roadmap, Backlog, KPIs"
                aria-invalid={!state?.ok && !!state?.fieldErrors?.name}
                className="h-10 border-b border-border bg-transparent pb-1 font-sans text-[1rem] outline-none focus:border-primary aria-[invalid=true]:border-destructive"
              />
              {!state?.ok && state?.fieldErrors?.name && (
                <span className="font-mono text-[0.68rem] text-destructive">
                  {state.fieldErrors.name}
                </span>
              )}
            </label>

            <label className="flex flex-col gap-2">
              <span className="eyebrow">Opis</span>
              <textarea
                name="description"
                rows={2}
                maxLength={280}
                placeholder="Opcjonalny — co ta tablica śledzi?"
                className="min-h-[2.5rem] resize-none border-b border-border bg-transparent pb-1 font-sans text-[0.95rem] outline-none focus:border-primary"
              />
            </label>

            <div className="flex flex-col gap-2">
              <span className="eyebrow">Widoki tej tablicy</span>
              <p className="font-mono text-[0.66rem] uppercase tracking-[0.12em] text-muted-foreground/80">
                wybierz, które widoki chcesz mieć
              </p>
              <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {VIEW_PRESETS.filter((p) => parentEnabled.includes(p.value)).map((p) => {
                  const on = selected.has(p.value);
                  const Icon = p.icon;
                  return (
                    <label
                      key={p.value}
                      data-on={on ? "true" : "false"}
                      className="group flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 font-mono text-[0.7rem] uppercase tracking-[0.12em] text-muted-foreground transition-all data-[on=true]:border-primary/60 data-[on=true]:bg-primary/10 data-[on=true]:text-foreground hover:border-primary/40"
                    >
                      <input
                        type="checkbox"
                        name="enabledViews"
                        value={p.value}
                        checked={on}
                        onChange={() => toggle(p.value)}
                        className="sr-only"
                      />
                      <Icon
                        size={13}
                        className="text-muted-foreground group-data-[on=true]:text-primary"
                      />
                      <span className="flex-1">{p.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {!state?.ok && state?.error && (
              <p className="font-mono text-[0.72rem] uppercase tracking-[0.14em] text-destructive">
                {state.error}
              </p>
            )}

            <div className="mt-1 flex items-center justify-end gap-3">
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
                {pending ? "Tworzę…" : "Utwórz tablicę"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
