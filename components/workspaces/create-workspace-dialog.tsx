"use client";

import { useActionState, useState, startTransition } from "react";
import { createWorkspaceAction, type WorkspaceFormState } from "@/app/(app)/workspaces/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  IconBoards,
  IconPlus,
  IconRoadmap,
  IconTable,
  IconTimeline,
  IconWhiteboard,
} from "@/components/ui/icons";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// The 5 ViewType variants the user can toggle. Empty selection falls back to
// all five server-side (see parseSelectedViews).
const VIEW_PRESETS = [
  { value: "TABLE", label: "Lista", icon: IconTable },
  { value: "KANBAN", label: "Tablica", icon: IconBoards },
  { value: "ROADMAP", label: "Roadmapa", icon: IconRoadmap },
  { value: "GANTT", label: "Oś czasu", icon: IconTimeline },
  { value: "WHITEBOARD", label: "Whiteboard", icon: IconWhiteboard },
] as const;

export function CreateWorkspaceDialog({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [state, formAction, pending] = useActionState<WorkspaceFormState, FormData>(
    createWorkspaceAction,
    null,
  );
  const fieldErrors = !state?.ok ? state?.fieldErrors : undefined;

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        <IconPlus />
        Nowa przestrzeń
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="lg">
          <form action={(fd) => startTransition(() => formAction(fd))} className="flex min-h-0 flex-col">
            <DialogHeader>
              <DialogTitle>Nowa przestrzeń robocza</DialogTitle>
              <DialogDescription>
                Po utworzeniu trafisz do niej automatycznie — z domyślną tablicą, do której możesz
                zaprosić innych.
              </DialogDescription>
            </DialogHeader>

            <DialogBody className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ws-name">Nazwa</Label>
                <Input
                  id="ws-name"
                  name="name"
                  required
                  autoFocus
                  maxLength={60}
                  placeholder="np. Marketing, Launch Q3"
                  error={fieldErrors?.name}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ws-description">Opis</Label>
                <Textarea
                  id="ws-description"
                  name="description"
                  rows={3}
                  maxLength={280}
                  placeholder="Opcjonalny — po co ta przestrzeń?"
                  error={fieldErrors?.description}
                />
              </div>

              <ViewsPicker />

              {!state?.ok && state?.error && (
                <p role="alert" className="rounded-md border border-danger bg-chip-red-bg px-3 py-2 text-xs text-danger-text">
                  {state.error}
                </p>
              )}
            </DialogBody>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Anuluj
              </Button>
              <Button type="submit" loading={pending} disabled={pending}>
                {pending ? "Tworzę…" : "Utwórz przestrzeń"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ViewsPicker() {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(VIEW_PRESETS.map((p) => p.value)),
  );

  const toggle = (v: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(v)) next.delete(v);
      else next.add(v);
      return next;
    });

  return (
    <div className="flex flex-col gap-1.5">
      <span className="eyebrow">Widoki w tej przestrzeni</span>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        {VIEW_PRESETS.map((p) => {
          const on = selected.has(p.value);
          const Icon = p.icon;
          return (
            <label
              key={p.value}
              data-on={on || undefined}
              className="flex h-9 cursor-pointer items-center gap-2 rounded-md border border-border bg-card px-2.5 text-sm text-muted-foreground data-on:border-orange-500 data-on:bg-selected data-on:text-foreground hover:bg-n-100"
            >
              <input
                type="checkbox"
                name="enabledViews"
                value={p.value}
                checked={on}
                onChange={() => toggle(p.value)}
                className="size-4 shrink-0 accent-[var(--control-on)]"
              />
              <Icon width={14} height={14} className={on ? "text-orange-700" : "text-n-500"} />
              <span className="truncate">{p.label}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
