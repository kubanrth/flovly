"use client";

// Inline status editor: StatusChip trigger → popover (bottom sheet <768px) with
// search, drag-reorder, add/edit/delete for board managers.

import { startTransition, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GripVertical } from "lucide-react";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { createStatusColumnAction, deleteStatusColumnAction, reorderStatusColumnsAction, updateStatusColumnAction } from "@/app/(app)/w/[workspaceId]/b/[boardId]/actions";
import { patchTaskAction } from "@/app/(app)/w/[workspaceId]/t/actions";
import { STATUS_PALETTE } from "@/lib/colors";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/chip";
import { Input, InputGroup } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { IconCheck, IconClose, IconPen, IconPlus, IconSearch } from "@/components/ui/icons";
import { hueForColor } from "@/components/ui/status-hue";

export interface StatusOption {
  id: string;
  name: string;
  colorHex: string;
}

export function StatusPicker({
  taskId,
  workspaceId,
  boardId,
  current,
  options,
  canEdit,
  canManageBoard,
}: {
  taskId: string;
  workspaceId: string;
  boardId: string;
  current: StatusOption | null;
  options: StatusOption[];
  canEdit: boolean;
  canManageBoard: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const isMobile = useIsMobile();
  // Optimistic pick until the server row lands (reset when `current` changes).
  const [override, setOverride] = useState<StatusOption | null | undefined>(undefined);
  const [prevCurrent, setPrevCurrent] = useState(current);
  if (prevCurrent !== current) {
    setPrevCurrent(current);
    setOverride(undefined);
  }
  const shown = override === undefined ? current : override;

  const close = () => {
    setOpen(false);
    setQuery("");
    setEditingId(null);
    setAdding(false);
  };
  const pick = (statusId: string) => {
    const next = shown?.id === statusId ? null : (options.find((o) => o.id === statusId) ?? null);
    setOverride(next);
    const fd = new FormData();
    fd.set("id", taskId);
    fd.set("statusColumnId", next?.id ?? "");
    startTransition(async () => {
      await patchTaskAction(fd);
      router.refresh();
    });
    close();
  };

  const chip = shown ? (
    <StatusChip label={shown.name} hue={hueForColor(shown.colorHex)} size="md" />
  ) : (
    <span className="inline-flex h-5 items-center rounded-sm border border-dashed border-n-300 px-[7px] text-2xs text-fg-3">— brak —</span>
  );
  if (!canEdit) return chip;

  const filtered = query.trim() ? options.filter((o) => o.name.toLowerCase().includes(query.trim().toLowerCase())) : options;
  const body = (mobile: boolean) => (
    <>
      <InputGroup size="sm" leading={<IconSearch />} autoFocus={!mobile} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Szukaj statusu…" aria-label="Szukaj statusu" className="mb-1 text-xs" />
      <ReorderableList
        options={options}
        filtered={filtered}
        workspaceId={workspaceId}
        boardId={boardId}
        currentId={shown?.id ?? null}
        canManageBoard={canManageBoard}
        editingId={editingId}
        setEditingId={setEditingId}
        isFiltered={query.trim().length > 0}
        adding={adding}
        onPick={pick}
      />
      {canManageBoard && (
        <div className="mt-1 border-t border-n-100 pt-1">
          {adding ? (
            <AddRow workspaceId={workspaceId} boardId={boardId} onDone={() => setAdding(false)} />
          ) : (
            <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => setAdding(true)}>
              <IconPlus />
              Dodaj status
            </Button>
          )}
        </div>
      )}
    </>
  );
  const triggerClass = "inline-flex h-7 max-w-full items-center rounded-sm px-1 outline-none hover:bg-n-100 data-popup-open:bg-n-100";

  if (isMobile) {
    return (
      <>
        <button type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(true)} className={triggerClass}>{chip}</button>
        <Sheet open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
          <SheetContent side="bottom" showCloseButton={false} className="gap-0 p-0">
            <div className="sheet-drag-handle" aria-hidden="true" />
            <SheetTitle className="px-4 pb-2 pt-3 text-base font-semibold">Status</SheetTitle>
            <div className="safe-bottom max-h-[70dvh] overflow-y-auto px-3 pb-3">{body(true)}</div>
          </SheetContent>
        </Sheet>
      </>
    );
  }
  return (
    <Popover open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <PopoverTrigger aria-haspopup="listbox" className={triggerClass}>{chip}</PopoverTrigger>
      <PopoverContent align="start" className="w-[260px] p-1.5">{body(false)}</PopoverContent>
    </Popover>
  );
}

function Row({ option, isCurrent, canManage, canDelete, canReorder, onPick, onEdit, onDelete }: {
  option: StatusOption;
  isCurrent: boolean;
  canManage: boolean;
  canDelete: boolean;
  canReorder: boolean;
  onPick: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: option.id, disabled: !canReorder });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 }}
      data-active={isCurrent || undefined}
      className="group flex h-8 items-center gap-0.5 rounded-md pr-0.5 hover:bg-n-100 data-active:bg-n-100"
    >
      {canReorder && (
        <button type="button" {...attributes} {...listeners} aria-label={`Przeciągnij ${option.name}`} className="inline-flex size-6 shrink-0 cursor-grab items-center justify-center rounded-sm text-n-400 opacity-0 outline-none group-hover:opacity-100 active:cursor-grabbing">
          <GripVertical size={12} strokeWidth={1.5} />
        </button>
      )}
      <button type="button" role="option" aria-selected={isCurrent} onClick={onPick} className={cn("flex h-full min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 text-left text-sm outline-none", !canReorder && "pl-2")}>
        <span className="size-2 shrink-0 rounded-full" style={{ background: option.colorHex }} aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate text-foreground">{option.name}</span>
        {isCurrent && <IconCheck width={14} height={14} className="shrink-0 text-success" />}
      </button>
      {canManage && (
        <Button variant="ghost" size="sm" iconOnly aria-label={`Edytuj ${option.name}`} onClick={onEdit} className="size-6 opacity-0 group-hover:opacity-100 focus-visible:opacity-100">
          <IconPen />
        </Button>
      )}
      {canDelete && (
        <Button variant="ghost" size="sm" iconOnly aria-label={`Usuń ${option.name}`} onClick={onDelete} className="size-6 opacity-0 hover:text-danger-text group-hover:opacity-100 focus-visible:opacity-100">
          <IconClose />
        </Button>
      )}
    </div>
  );
}

function StatusForm({ initialName, initialColor, submitLabel, onSubmit, onDone }: { initialName: string; initialColor: string; submitLabel: string; onSubmit: (name: string, color: string) => void; onDone: () => void }) {
  const [name, setName] = useState(initialName);
  const [color, setColor] = useState(initialColor);
  const submit = () => name.trim() && onSubmit(name.trim(), color);
  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-orange-500 bg-selected p-2">
      <Input
        autoFocus
        size="sm"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          } else if (e.key === "Escape") onDone();
        }}
        maxLength={40}
        placeholder="Nazwa statusu…"
        aria-label="Nazwa statusu"
      />
      <div className="flex items-center gap-1" role="radiogroup" aria-label="Kolor">
        {STATUS_PALETTE.map((c) => (
          <button key={c} type="button" role="radio" aria-checked={c === color} aria-label={`Kolor ${c}`} onClick={() => setColor(c)} className={cn("size-5 rounded-full outline-none hover:shadow-[0_0_0_2px_var(--n-300)]", c === color && "shadow-[0_0_0_2px_var(--n-900)]")} style={{ background: c }} />
        ))}
      </div>
      <div className="flex items-center justify-end gap-1">
        <Button variant="ghost" size="sm" onClick={onDone}>Anuluj</Button>
        <Button size="sm" onClick={submit} disabled={!name.trim()}>{submitLabel}</Button>
      </div>
    </div>
  );
}

function AddRow({ workspaceId, boardId, onDone }: { workspaceId: string; boardId: string; onDone: () => void }) {
  return (
    <StatusForm
      initialName=""
      initialColor={STATUS_PALETTE[0]!}
      submitLabel="Dodaj"
      onDone={onDone}
      onSubmit={(name, colorHex) => {
        const fd = new FormData();
        fd.set("workspaceId", workspaceId);
        fd.set("boardId", boardId);
        fd.set("name", name);
        fd.set("colorHex", colorHex);
        startTransition(async () => {
          await createStatusColumnAction(fd);
          onDone();
        });
      }}
    />
  );
}

function ReorderableList({ options, filtered, workspaceId, boardId, currentId, canManageBoard, editingId, setEditingId, isFiltered, adding, onPick }: {
  options: StatusOption[];
  filtered: StatusOption[];
  workspaceId: string;
  boardId: string;
  currentId: string | null;
  canManageBoard: boolean;
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  isFiltered: boolean;
  adding: boolean;
  onPick: (id: string) => void;
}) {
  // Optimistic mirror of the order until the server revalidate lands.
  const [order, setOrder] = useState<StatusOption[]>(options);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrder(options);
  }, [options]);
  const canReorder = canManageBoard && !isFiltered && !editingId && !adding;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = order.findIndex((s) => s.id === active.id);
    const to = order.findIndex((s) => s.id === over.id);
    if (from < 0 || to < 0) return;
    const next = arrayMove(order, from, to);
    setOrder(next);
    const fd = new FormData();
    fd.set("workspaceId", workspaceId);
    fd.set("boardId", boardId);
    fd.set("ids", next.map((s) => s.id).join(","));
    startTransition(() => reorderStatusColumnsAction(fd));
  };
  const idx = new Map(order.map((s, i) => [s.id, i]));
  const visible = isFiltered ? filtered : [...filtered].sort((a, b) => (idx.get(a.id) ?? 0) - (idx.get(b.id) ?? 0));

  return (
    <div role="listbox" aria-label="Status" className="flex max-h-[280px] flex-col overflow-y-auto overscroll-contain">
      {visible.length === 0 && !adding && <p className="px-2 py-3 text-center text-xs text-fg-3">Brak statusów</p>}
      <DndContext id="status-columns" sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={visible.map((o) => o.id)} strategy={verticalListSortingStrategy}>
          {visible.map((o) =>
            editingId === o.id ? (
              <StatusForm
                key={o.id}
                initialName={o.name}
                initialColor={o.colorHex}
                submitLabel="Zapisz"
                onDone={() => setEditingId(null)}
                onSubmit={(name, colorHex) => {
                  const fd = new FormData();
                  fd.set("workspaceId", workspaceId);
                  fd.set("columnId", o.id);
                  fd.set("name", name);
                  fd.set("colorHex", colorHex);
                  startTransition(async () => {
                    await updateStatusColumnAction(fd);
                    setEditingId(null);
                  });
                }}
              />
            ) : (
              <Row
                key={o.id}
                option={o}
                isCurrent={currentId === o.id}
                canManage={canManageBoard}
                canDelete={canManageBoard && options.length > 1}
                canReorder={canReorder}
                onPick={() => onPick(o.id)}
                onEdit={() => setEditingId(o.id)}
                onDelete={() => {
                  if (!confirm(`Usunąć status „${o.name}”?`)) return;
                  const fd = new FormData();
                  fd.set("workspaceId", workspaceId);
                  fd.set("columnId", o.id);
                  startTransition(() => deleteStatusColumnAction(fd));
                }}
              />
            ),
          )}
        </SortableContext>
      </DndContext>
    </div>
  );
}
