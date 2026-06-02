"use client";

import { useEffect, useState, useTransition } from "react";
import { GripVertical, Plus, Settings, Trash2, X } from "lucide-react";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  createDealStageAction,
  deleteDealStageAction,
  reorderDealStagesAction,
  updateDealStageAction,
} from "@/app/(app)/w/[workspaceId]/sales/actions";

export interface ManagedStage {
  id: string;
  name: string;
  colorHex: string;
  closedKind: "won" | "lost" | null;
  // Live count from server. Server also enforces non-deletion when > 0; this
  // is just to render the delete button disabled with an explanation.
  dealCount: number;
}

const SWATCHES = [
  "#64748B",
  "#3B82F6",
  "#8B5CF6",
  "#7B68EE",
  "#F59E0B",
  "#10B981",
  "#EF4444",
  "#94A3B8",
];

export function StageManagerDialog({
  workspaceId,
  initialStages,
}: {
  workspaceId: string;
  initialStages: ManagedStage[];
}) {
  const [open, setOpen] = useState(false);
  // Local mirror of the server-passed list so drag-drop feels instant. Resync
  // happens implicitly because each action triggers revalidatePath → parent
  // re-renders with fresh `initialStages` (which propagates via key on this
  // component? actually no — see useEffect below).
  const [stages, setStages] = useState<ManagedStage[]>(initialStages);
  // Resync local mirror when server returns a fresh list (revalidate after a
  // mutation). Cheap fingerprint so we only reset when actual content changed
  // — not on every render of the parent.
  const fingerprint = initialStages
    .map((s) => `${s.id}:${s.name}:${s.colorHex}:${s.closedKind}:${s.dealCount}`)
    .join("|");
  useEffect(() => {
    setStages(initialStages);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fingerprint]);

  const [, startPatch] = useTransition();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIx = stages.findIndex((s) => s.id === active.id);
    const newIx = stages.findIndex((s) => s.id === over.id);
    if (oldIx < 0 || newIx < 0) return;
    const next = arrayMove(stages, oldIx, newIx);
    setStages(next);
    const fd = new FormData();
    fd.set("workspaceId", workspaceId);
    fd.set("orderedIds", next.map((s) => s.id).join(","));
    startPatch(() => {
      void reorderDealStagesAction(fd);
    });
  };

  const submitUpdate = (stageId: string, fields: Partial<ManagedStage>) => {
    const stage = stages.find((s) => s.id === stageId);
    if (!stage) return;
    const next: ManagedStage = { ...stage, ...fields };
    setStages((arr) => arr.map((s) => (s.id === stageId ? next : s)));
    const fd = new FormData();
    fd.set("workspaceId", workspaceId);
    fd.set("stageId", stageId);
    fd.set("name", next.name);
    fd.set("colorHex", next.colorHex);
    fd.set("closedKind", next.closedKind ?? "");
    startPatch(() => {
      void updateDealStageAction(fd);
    });
  };

  const submitDelete = (stageId: string) => {
    const stage = stages.find((s) => s.id === stageId);
    if (!stage || stage.dealCount > 0) return;
    if (!confirm(`Usunąć etap „${stage.name}”?`)) return;
    setStages((arr) => arr.filter((s) => s.id !== stageId));
    const fd = new FormData();
    fd.set("workspaceId", workspaceId);
    fd.set("stageId", stageId);
    startPatch(() => {
      void deleteDealStageAction(fd);
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-3 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
      >
        <Settings size={12} /> Etapy
      </button>

      <BaseDialog.Root open={open} onOpenChange={(next) => !next && setOpen(false)}>
        <BaseDialog.Portal>
          <BaseDialog.Backdrop className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm" />
          <BaseDialog.Popup className="fixed left-1/2 top-1/2 z-50 flex max-h-[85vh] w-[min(640px,92vw)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-border bg-background shadow-[0_24px_48px_-12px_rgba(0,0,0,0.25)]">
            <div className="flex items-center justify-between border-b border-border px-6 py-3">
              <BaseDialog.Title className="eyebrow">Etapy pipeline</BaseDialog.Title>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Zamknij"
                className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <X size={14} />
              </button>
            </div>

            <div className="flex max-h-full flex-col gap-4 overflow-y-auto px-6 py-5">
              <p className="text-[0.86rem] leading-[1.55] text-muted-foreground">
                Przeciągnij za uchwyt aby zmienić kolejność etapów. Zmiany nazwy
                i koloru zapisują się po wyjściu z pola. Etap nie może być
                usunięty dopóki ma podpięte deale.
              </p>

              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={onDragEnd}
              >
                <SortableContext
                  items={stages.map((s) => s.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <ul className="flex flex-col gap-2">
                    {stages.map((stage) => (
                      <StageRow
                        key={stage.id}
                        stage={stage}
                        onChange={(fields) => submitUpdate(stage.id, fields)}
                        onDelete={() => submitDelete(stage.id)}
                      />
                    ))}
                  </ul>
                </SortableContext>
              </DndContext>

              <AddStageForm workspaceId={workspaceId} />
            </div>
          </BaseDialog.Popup>
        </BaseDialog.Portal>
      </BaseDialog.Root>
    </>
  );
}

function StageRow({
  stage,
  onChange,
  onDelete,
}: {
  stage: ManagedStage;
  onChange: (fields: Partial<ManagedStage>) => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: stage.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-card p-2 md:flex-nowrap"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Przeciągnij"
        className="grid h-7 w-7 shrink-0 cursor-grab place-items-center rounded-md text-muted-foreground/60 transition-colors hover:bg-accent hover:text-foreground active:cursor-grabbing"
      >
        <GripVertical size={14} />
      </button>

      <input
        type="color"
        defaultValue={stage.colorHex}
        onChange={(e) => onChange({ colorHex: e.target.value })}
        aria-label="Kolor etapu"
        className="h-7 w-9 shrink-0 cursor-pointer rounded-md border border-border bg-transparent"
      />

      <input
        type="text"
        defaultValue={stage.name}
        maxLength={60}
        onBlur={(e) => {
          const v = e.target.value.trim();
          if (v.length > 0 && v !== stage.name) onChange({ name: v });
        }}
        className="h-8 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-[0.9rem] outline-none focus:border-primary"
      />

      <select
        defaultValue={stage.closedKind ?? ""}
        onChange={(e) => {
          const v = e.target.value;
          onChange({ closedKind: v === "won" || v === "lost" ? v : null });
        }}
        aria-label="Typ etapu końcowego"
        className="h-8 shrink-0 rounded-md border border-border bg-background px-2 text-[0.82rem] outline-none focus:border-primary"
      >
        <option value="">Otwarty</option>
        <option value="won">Wygrane</option>
        <option value="lost">Przegrane</option>
      </select>

      <button
        type="button"
        onClick={onDelete}
        disabled={stage.dealCount > 0}
        title={
          stage.dealCount > 0
            ? `Etap ma ${stage.dealCount} deal(i) — przenieś je najpierw.`
            : "Usuń etap"
        }
        className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Trash2 size={13} />
      </button>
    </li>
  );
}

function AddStageForm({ workspaceId }: { workspaceId: string }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(SWATCHES[1]);
  const [closedKind, setClosedKind] = useState<"" | "won" | "lost">("");
  const [, startPatch] = useTransition();

  const submit = () => {
    if (!name.trim()) return;
    const fd = new FormData();
    fd.set("workspaceId", workspaceId);
    fd.set("name", name.trim());
    fd.set("colorHex", color);
    fd.set("closedKind", closedKind);
    startPatch(() => {
      void createDealStageAction(fd).then(() => {
        setName("");
        setClosedKind("");
        setColor(SWATCHES[1]);
      });
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed border-border bg-muted/20 p-2 md:flex-nowrap">
      <Plus size={14} className="shrink-0 text-muted-foreground" />
      <input
        type="color"
        value={color}
        onChange={(e) => setColor(e.target.value)}
        aria-label="Kolor nowego etapu"
        className="h-7 w-9 shrink-0 cursor-pointer rounded-md border border-border bg-transparent"
      />
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          }
        }}
        maxLength={60}
        placeholder="Nazwa nowego etapu…"
        className="h-8 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-[0.9rem] outline-none focus:border-primary"
      />
      <select
        value={closedKind}
        onChange={(e) =>
          setClosedKind(e.target.value === "won" || e.target.value === "lost" ? e.target.value : "")
        }
        aria-label="Typ nowego etapu"
        className="h-8 shrink-0 rounded-md border border-border bg-background px-2 text-[0.82rem] outline-none focus:border-primary"
      >
        <option value="">Otwarty</option>
        <option value="won">Wygrane</option>
        <option value="lost">Przegrane</option>
      </select>
      <button
        type="button"
        onClick={submit}
        disabled={!name.trim()}
        className="inline-flex h-8 shrink-0 items-center rounded-md bg-brand-gradient px-3 font-mono text-[0.66rem] uppercase tracking-[0.14em] text-white shadow-brand transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Dodaj etap
      </button>
    </div>
  );
}
