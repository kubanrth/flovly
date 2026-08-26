"use client";

// Redesign v5 (B12): `+` 32×40 in the tabs row → 720px dialog with 9 type
// tiles, name, visibility, footer Anuluj / Utwórz widok.
//
// Two creation modes (unchanged): if the picked type has no default
// BoardView on this board, an empty name recreates the default (→ /<view>);
// otherwise a name is required and a custom view is created (→ /v/<id>).

import { startTransition, useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { IconDoc, IconGrid, IconPlus } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import {
  createBoardViewAction,
  type CreateViewState,
} from "@/app/(app)/w/[workspaceId]/b/[boardId]/actions";
import { VIEW_ICON, VIEW_LABEL, type ViewName } from "@/components/view/view-switcher";

type ViewType = "TABLE" | "KANBAN" | "GANTT" | "ROADMAP" | "CALENDAR" | "WHITEBOARD" | "TASKLINE";

const TILES: { value: ViewType | null; name?: ViewName; label: string; desc: string; icon: ReactNode }[] = [
  { value: "TABLE", name: "table", label: VIEW_LABEL.table, desc: "Tabela z kolumnami pól, grupowaniem i sumami.", icon: VIEW_ICON.table },
  { value: "KANBAN", name: "kanban", label: VIEW_LABEL.kanban, desc: "Kanban z kolumnami statusów i limitem WIP.", icon: VIEW_ICON.kanban },
  { value: "GANTT", name: "gantt", label: VIEW_LABEL.gantt, desc: "Gantt z milestone'ami i zależnościami.", icon: VIEW_ICON.gantt },
  { value: "ROADMAP", name: "roadmap", label: VIEW_LABEL.roadmap, desc: "Milestone'y wielu tablic na jednej osi.", icon: VIEW_ICON.roadmap },
  { value: "CALENDAR", name: "calendar", label: VIEW_LABEL.calendar, desc: "Zadania na siatce miesiąca wg terminów.", icon: VIEW_ICON.calendar },
  { value: "WHITEBOARD", name: "whiteboard", label: VIEW_LABEL.whiteboard, desc: "Notatki, ramki, strzałki i karty zadań.", icon: VIEW_ICON.whiteboard },
  { value: "TASKLINE", name: "taskline", label: VIEW_LABEL.taskline, desc: "Pipeline etapów od zgłoszenia do wdrożenia.", icon: VIEW_ICON.taskline },
  // Not a BoardView type (one per board, always present) → disabled tiles.
  { value: null, label: "Opis", desc: "Dokument tablicy — zasady, notatki, linki.", icon: <IconDoc /> },
  { value: null, label: "Podsumowanie", desc: "Liczniki, wykresy statusów, obciążenie zespołu.", icon: <IconGrid /> },
];

export function CreateViewDialog({
  workspaceId,
  boardId,
  enabled,
  existingDefaultTypes,
}: {
  workspaceId: string;
  boardId: string;
  // Workspace-level enabled set — kept for API compat; the server accepts any type.
  enabled: ViewName[];
  // Types whose default BoardView (name=null) exists on this board.
  existingDefaultTypes: ViewName[];
}) {
  void enabled;
  const router = useRouter();
  const nameRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<ViewType>("TABLE");
  const [name, setName] = useState("");
  const [state, formAction, pending] = useActionState<CreateViewState, FormData>(createBoardViewAction, null);

  useEffect(() => {
    if (state?.ok) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpen(false);
      router.push(state.defaultPath ?? `/w/${workspaceId}/b/${boardId}/v/${state.viewId}`);
      router.refresh();
    }
  }, [state, router, workspaceId, boardId]);

  const tile = TILES.find((t) => t.value === type);
  const recreatingDefault = !!tile?.name && !existingDefaultTypes.includes(tile.name);
  const nameError = state && !state.ok ? state.fieldErrors?.name : undefined;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Nowy widok"
        title="Nowy widok"
        className="inline-flex h-10 w-8 shrink-0 items-center justify-center text-n-500 outline-none hover:text-foreground active:text-foreground max-md:h-11"
      >
        <IconPlus />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="xl" data-ui="new-view-dialog" initialFocus={nameRef}>
          <DialogHeader>
            <DialogTitle>Nowy widok tablicy</DialogTitle>
          </DialogHeader>
          <form
            action={(fd) => {
              fd.set("workspaceId", workspaceId);
              fd.set("boardId", boardId);
              fd.set("type", type);
              startTransition(() => formAction(fd));
            }}
            className="flex min-h-0 flex-1 flex-col"
          >
            <DialogBody className="flex flex-col gap-4">
              <div role="radiogroup" aria-label="Typ widoku" className="grid grid-cols-3 gap-2.5 max-md:grid-cols-1">
                {TILES.map((t) => {
                  const on = t.value !== null && t.value === type;
                  return (
                    <button
                      key={t.label}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      disabled={t.value === null}
                      title={t.value === null ? "Ten widok jest zawsze na tablicy — nie tworzy się go jako dodatkowy." : undefined}
                      onClick={() => t.value && setType(t.value)}
                      className={cn(
                        "flex flex-col items-start rounded-lg border border-border bg-card p-3 text-left outline-none hover:border-n-400 active:bg-n-50 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border",
                        on && "border-orange-500 bg-selected shadow-[inset_0_0_0_1px_var(--orange-500)] hover:border-orange-500",
                      )}
                    >
                      <span className={cn("text-n-700 [&_svg]:size-4", on && "text-orange-700")}>{t.icon}</span>
                      <span className="mt-2 text-sm font-semibold text-foreground">{t.label}</span>
                      <span className="mt-0.5 text-2xs text-muted-foreground">{t.desc}</span>
                    </button>
                  );
                })}
              </div>

              <div className="flex gap-3 max-md:flex-col">
                <div className="flex flex-1 flex-col gap-1.5">
                  <Label htmlFor="new-view-name" className="text-xs font-medium text-n-700">Nazwa widoku</Label>
                  <Input
                    ref={nameRef}
                    id="new-view-name"
                    name="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={60}
                    required={!recreatingDefault}
                    placeholder={recreatingDefault ? `Puste = przywróć domyślny widok ${tile?.label}` : "np. Backlog P3"}
                    error={nameError}
                  />
                </div>
                <div className="flex w-[200px] flex-col gap-1.5 max-md:w-full">
                  <Label htmlFor="new-view-visibility" className="text-xs font-medium text-n-700">Widoczność</Label>
                  {/* ponytail: BoardView has no visibility column — display-only until the backend adds one */}
                  <Select id="new-view-visibility" aria-label="Widoczność" items={[{ value: "team", label: "Cały zespół" }]} value="team" disabled />
                </div>
              </div>

              {state && !state.ok && state.error && <p className="text-xs text-danger-text">{state.error}</p>}
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Anuluj</Button>
              <Button type="submit" loading={pending}>
                {recreatingDefault && !name.trim() ? `Przywróć ${tile?.label}` : "Utwórz widok"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
