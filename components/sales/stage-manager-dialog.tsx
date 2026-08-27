"use client";

// CRUD etapów pipeline'u: nazwa, kolor, kolejność (drag), typ końcowy
// (otwarty / wygrane / przegrane). Akcje serwerowe bez zmian.

import { useEffect, useState, useTransition } from "react";
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
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { IconMove, IconPlus, IconSettings, IconTrash } from "@/components/ui/icons";
import { STATUS_PALETTE } from "@/lib/colors";

export interface ManagedStage {
  id: string;
  name: string;
  colorHex: string;
  closedKind: "won" | "lost" | null;
  // Licznik z serwera — serwer i tak odmawia kasowania niepustego etapu,
  // tu służy tylko do wyszarzenia przycisku z wyjaśnieniem.
  dealCount: number;
}

const KIND_ITEMS = [
  { value: "open", label: "Otwarty" },
  { value: "won", label: "Wygrane" },
  { value: "lost", label: "Przegrane" },
];
const toKind = (v: string): "won" | "lost" | null => (v === "won" || v === "lost" ? v : null);

export function StageManagerDialog({
  workspaceId,
  initialStages,
}: {
  workspaceId: string;
  initialStages: ManagedStage[];
}) {
  const [stages, setStages] = useState<ManagedStage[]>(initialStages);
  // Resync po revalidate — tani odcisk palca, żeby nie resetować co render.
  const fingerprint = initialStages
    .map((s) => `${s.id}:${s.name}:${s.colorHex}:${s.closedKind}:${s.dealCount}`)
    .join("|");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
    const from = stages.findIndex((s) => s.id === active.id);
    const to = stages.findIndex((s) => s.id === over.id);
    if (from < 0 || to < 0) return;
    const next = arrayMove(stages, from, to);
    setStages(next);
    const fd = new FormData();
    fd.set("workspaceId", workspaceId);
    fd.set("orderedIds", next.map((s) => s.id).join(","));
    startPatch(() => void reorderDealStagesAction(fd));
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
    startPatch(() => void updateDealStageAction(fd));
  };

  const submitDelete = (stageId: string) => {
    const stage = stages.find((s) => s.id === stageId);
    if (!stage || stage.dealCount > 0) return;
    if (!confirm(`Usunąć etap „${stage.name}”?`)) return;
    setStages((arr) => arr.filter((s) => s.id !== stageId));
    const fd = new FormData();
    fd.set("workspaceId", workspaceId);
    fd.set("stageId", stageId);
    startPatch(() => void deleteDealStageAction(fd));
  };

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="secondary" />}>
        <IconSettings width={14} height={14} />
        Etapy
      </DialogTrigger>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Etapy pipeline</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-3">
          <p className="text-xs text-muted-foreground">
            Przeciągnij za uchwyt, aby zmienić kolejność. Nazwa i kolor zapisują się po
            wyjściu z pola. Etapu z dealami nie da się usunąć.
          </p>

          <DndContext id="sales-stages" sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={stages.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              <ul className="flex flex-col gap-1.5">
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
        </DialogBody>
      </DialogContent>
    </Dialog>
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
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: stage.id });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-card p-1.5 md:flex-nowrap"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Przeciągnij etap ${stage.name}`}
        className="grid size-7 shrink-0 cursor-grab place-items-center rounded-md text-muted-foreground outline-none hover:bg-n-100 hover:text-foreground active:cursor-grabbing active:bg-n-200"
      >
        <IconMove width={14} height={14} />
      </button>

      <ColorInput value={stage.colorHex} label={`Kolor etapu ${stage.name}`} onChange={(v) => onChange({ colorHex: v })} />

      <Input
        defaultValue={stage.name}
        maxLength={60}
        aria-label={`Nazwa etapu ${stage.name}`}
        className="min-w-0 flex-1"
        onBlur={(e) => {
          const v = e.target.value.trim();
          if (v.length > 0 && v !== stage.name) onChange({ name: v });
        }}
      />

      <Select
        items={KIND_ITEMS}
        value={stage.closedKind ?? "open"}
        onValueChange={(v) => onChange({ closedKind: toKind(v) })}
        aria-label={`Typ etapu ${stage.name}`}
        className="w-[124px] shrink-0"
      />

      <Button
        variant="ghost"
        iconOnly
        onClick={onDelete}
        disabled={stage.dealCount > 0}
        aria-label={`Usuń etap ${stage.name}`}
        title={stage.dealCount > 0 ? `Etap ma ${stage.dealCount} deal(i) — przenieś je najpierw.` : "Usuń etap"}
        className="shrink-0 hover:text-danger-text"
      >
        <IconTrash width={14} height={14} />
      </Button>
    </li>
  );
}

function AddStageForm({ workspaceId }: { workspaceId: string }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(STATUS_PALETTE[5]!);
  const [kind, setKind] = useState("open");
  const [, startPatch] = useTransition();

  const submit = () => {
    if (!name.trim()) return;
    const fd = new FormData();
    fd.set("workspaceId", workspaceId);
    fd.set("name", name.trim());
    fd.set("colorHex", color);
    fd.set("closedKind", toKind(kind) ?? "");
    startPatch(() => {
      void createDealStageAction(fd).then(() => {
        setName("");
        setKind("open");
      });
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed border-input-border p-1.5 md:flex-nowrap">
      <span className="grid size-7 shrink-0 place-items-center text-muted-foreground" aria-hidden>
        <IconPlus width={14} height={14} />
      </span>
      <ColorInput value={color} label="Kolor nowego etapu" onChange={setColor} />
      <Input
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
        aria-label="Nazwa nowego etapu"
        className="min-w-0 flex-1"
      />
      <Select items={KIND_ITEMS} value={kind} onValueChange={setKind} aria-label="Typ nowego etapu" className="w-[124px] shrink-0" />
      <Button onClick={submit} disabled={!name.trim()} className="shrink-0">
        Dodaj etap
      </Button>
    </div>
  );
}

// Natywny color picker w opakowaniu 32×32 — pole `<input type=color>` nie
// przyjmuje tokenów, więc kolor idzie inline (to dana z bazy, nie token).
function ColorInput({ value, label, onChange }: { value: string; label: string; onChange: (v: string) => void }) {
  return (
    <span className="relative inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-input-border hover:border-input-border-hover">
      <span className="size-4 rounded-full" style={{ background: value }} aria-hidden />
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className="absolute inset-0 cursor-pointer opacity-0"
      />
    </span>
  );
}
