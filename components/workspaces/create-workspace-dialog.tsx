"use client";

import { useActionState, useState, startTransition } from "react";
import { Table2, KanbanSquare, GitBranch, BarChart3, Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createWorkspaceAction,
  type WorkspaceFormState,
} from "@/app/(app)/workspaces/actions";

// The 5 ViewType variants the user can toggle. Defaults below match
// historical behaviour (all on) so existing muscle memory still works.
const VIEW_PRESETS = [
  { value: "TABLE", label: "Tabela", icon: Table2, defaultOn: true },
  { value: "KANBAN", label: "Kanban", icon: KanbanSquare, defaultOn: true },
  { value: "ROADMAP", label: "Roadmapa", icon: GitBranch, defaultOn: true },
  { value: "GANTT", label: "Gantt", icon: BarChart3, defaultOn: true },
  { value: "WHITEBOARD", label: "Whiteboard", icon: Pencil, defaultOn: true },
] as const;

export function CreateWorkspaceDialog() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<WorkspaceFormState, FormData>(
    createWorkspaceAction,
    null,
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group flex min-h-[180px] flex-col items-start justify-between rounded-xl border border-dashed border-border p-6 text-left text-muted-foreground transition-all hover:border-primary/60 hover:bg-accent/50 hover:text-foreground focus-visible:border-primary focus-visible:text-foreground focus-visible:outline-none"
      >
        <span className="eyebrow transition-colors group-hover:text-primary">
          Nowa przestrzeń
        </span>
        <div className="flex flex-col gap-1">
          <span className="font-display text-[1.35rem] font-bold leading-[1.15] tracking-[-0.02em]">
            + Utwórz workspace
          </span>
          <span className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-muted-foreground">
            kliknij aby rozpocząć
          </span>
        </div>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-2xl border-border bg-card shadow-aura sm:max-w-[560px]">
          <DialogHeader>
            <span className="eyebrow">Nowa przestrzeń robocza</span>
            <DialogTitle className="font-display text-[1.65rem] font-bold leading-[1.15] tracking-[-0.02em] text-foreground">
              Jak nazwiemy tę <span className="text-brand-gradient">przestrzeń?</span>
            </DialogTitle>
            <DialogDescription className="text-[0.92rem] leading-[1.55] text-muted-foreground">
              Po utworzeniu trafisz do niej automatycznie. Zaczniesz z domyślną
              tablicą, do której możesz zaprosić innych.
            </DialogDescription>
          </DialogHeader>

          <form
            action={(fd) => startTransition(() => formAction(fd))}
            className="mt-2 flex flex-col gap-6"
          >
            <Field
              label="Nazwa"
              name="name"
              type="text"
              required
              autoFocus
              maxLength={60}
              placeholder="np. Marketing, Launch Q3"
              error={!state?.ok ? state?.fieldErrors?.name : undefined}
            />
            <Field
              label="Opis"
              name="description"
              type="text"
              asTextarea
              maxLength={280}
              placeholder="Opcjonalny — po co ta przestrzeń?"
              error={!state?.ok ? state?.fieldErrors?.description : undefined}
            />

            <ViewsPicker />

            {!state?.ok && state?.error && (
              <p className="font-mono text-[0.72rem] uppercase tracking-[0.14em] text-destructive">
                {state.error}
              </p>
            )}

            <div className="mt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="font-mono text-[0.72rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground"
              >
                Anuluj
              </button>
              <button
                type="submit"
                disabled={pending}
                className="inline-flex h-11 items-center justify-center rounded-lg bg-brand-gradient px-6 font-sans text-[0.9rem] font-semibold text-white shadow-brand transition-[transform,opacity] duration-200 hover:-translate-y-[1px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:translate-y-0 disabled:opacity-60"
              >
                {pending ? "Tworzę…" : "Utwórz przestrzeń"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Uncontrolled multi-checkbox. Rendered as tile buttons so the picker
// feels like a choice, not a form. Empty selection falls back to all
// five server-side (see parseSelectedViews).
function ViewsPicker() {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(VIEW_PRESETS.filter((p) => p.defaultOn).map((p) => p.value)),
  );

  const toggle = (v: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(v)) next.delete(v);
      else next.add(v);
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="eyebrow">Widoki w tej przestrzeni</span>
      <p className="font-mono text-[0.7rem] uppercase tracking-[0.12em] text-muted-foreground/80">
        wybierz, które widoki mają być aktywne dla każdej tablicy
      </p>
      <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {VIEW_PRESETS.map((p) => {
          const on = selected.has(p.value);
          const Icon = p.icon;
          return (
            <label
              key={p.value}
              data-on={on ? "true" : "false"}
              className="group flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 font-mono text-[0.72rem] uppercase tracking-[0.12em] text-muted-foreground transition-all data-[on=true]:border-primary/60 data-[on=true]:bg-primary/10 data-[on=true]:text-foreground hover:border-primary/40"
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
                size={14}
                className="text-muted-foreground group-data-[on=true]:text-primary"
              />
              <span className="flex-1">{p.label}</span>
              <span
                aria-hidden
                className="h-3.5 w-3.5 rounded-sm border border-border bg-background transition-colors group-data-[on=true]:border-primary group-data-[on=true]:bg-primary"
              />
            </label>
          );
        })}
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  type,
  required,
  autoFocus,
  maxLength,
  placeholder,
  asTextarea,
  error,
}: {
  label: string;
  name: string;
  type: string;
  required?: boolean;
  autoFocus?: boolean;
  maxLength?: number;
  placeholder?: string;
  asTextarea?: boolean;
  error?: string;
}) {
  const common = {
    name,
    required,
    autoFocus,
    maxLength,
    placeholder,
    "aria-invalid": !!error,
    className:
      "bg-transparent pb-1 text-[1rem] font-sans outline-none placeholder:text-muted-foreground/60 focus:border-primary aria-[invalid=true]:border-destructive",
  };
  return (
    <label className="flex flex-col gap-2">
      <span className="eyebrow">{label}</span>
      {asTextarea ? (
        <textarea
          {...common}
          rows={3}
          className={`${common.className} min-h-[3rem] resize-none border-b border-border`}
        />
      ) : (
        <input {...common} type={type} className={`${common.className} h-10 border-b border-border`} />
      )}
      {error && (
        <span className="font-mono text-[0.68rem] text-destructive">{error}</span>
      )}
    </label>
  );
}
