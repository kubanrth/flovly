"use client";

// Portal-rendered so popover isn't clipped by overflow-x-auto table wrapper.

import { startTransition, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, GripVertical, Pencil, Plus, Search, X } from "lucide-react";
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
  createStatusColumnAction,
  deleteStatusColumnAction,
  reorderStatusColumnsAction,
  updateStatusColumnAction,
} from "@/app/(app)/w/[workspaceId]/b/[boardId]/actions";
import { patchTaskAction } from "@/app/(app)/w/[workspaceId]/t/actions";

export interface StatusOption {
  id: string;
  name: string;
  colorHex: string;
}

// Paleta z `lib/colors.ts` (BRAND_PALETTE).
import { STATUS_PALETTE as PRESET_COLORS } from "@/lib/colors";

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
  // Whether the user can add/edit/delete statuses (board.update perm).
  canManageBoard: boolean;
}) {
  const [open, setOpen] = useState(false);
  // Either `top` (opening downward) or `bottom` (opening upward) is set, never
  // both. Anchoring by `bottom` when above keeps a short list glued to the cell.
  const [coords, setCoords] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    maxHeight: number;
  } | null>(null);
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  const computeCoords = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return null;
    // Jeśli trigger jest poza viewportem (user scrolluje
    // tabelę lub stronę), zwracamy null — caller zamknie picker
    // zamiast pozwolić mu utknąć przy górze viewportu.
    if (
      rect.bottom < 0 ||
      rect.top > window.innerHeight ||
      rect.right < 0 ||
      rect.left > window.innerWidth
    ) {
      return null;
    }
    const POP_WIDTH = 280;
    const GAP = 4;
    const PAD = 12;
    const spaceBelow = window.innerHeight - rect.bottom - GAP - PAD;
    const spaceAbove = rect.top - GAP - PAD;
    const useBelow = spaceBelow >= 260 || spaceBelow >= spaceAbove;
    const left = Math.max(8, Math.min(window.innerWidth - POP_WIDTH - 8, rect.left));
    if (useBelow) {
      return { top: rect.bottom + GAP, left, maxHeight: Math.max(220, spaceBelow) };
    }
    // Opening upward: anchor the popup's BOTTOM edge just above the trigger so a
    // short list hugs the cell instead of floating at the top of the viewport.
    return {
      bottom: window.innerHeight - rect.top + GAP,
      left,
      maxHeight: Math.max(220, spaceAbove),
    };
  };

  const openPicker = () => {
    const c = computeCoords();
    if (!c) return;
    setCoords(c);
    setOpen(true);
  };

  const close = () => {
    setOpen(false);
    setCoords(null);
    setQuery("");
    setEditingId(null);
    setAdding(false);
  };

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (
        !popRef.current?.contains(e.target as Node) &&
        !triggerRef.current?.contains(e.target as Node)
      ) {
        close();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const onReflow = () => {
      const c = computeCoords();
      if (c) {
        setCoords(c);
      } else {
        // Trigger wyjechał z viewportu — zamykamy zamiast
        // zostawiać picker oddzielony od triggera.
        close();
      }
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onReflow);
    window.addEventListener("scroll", onReflow, true);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onReflow);
      window.removeEventListener("scroll", onReflow, true);
    };
  }, [open]);

  const pick = (statusId: string) => {
    // Toggle off if clicking the current selection — feels more
    // forgiving than "you must reopen the picker to clear".
    const next = current?.id === statusId ? "" : statusId;
    const fd = new FormData();
    fd.set("id", taskId);
    fd.set("statusColumnId", next);
    startTransition(() => patchTaskAction(fd));
    close();
  };

  // Read-only fallback for non-editors. Hook ordering must remain
  // stable, so this branch is below all hook calls.
  if (!canEdit) {
    return current ? <Pill option={current} /> : <Empty />;
  }

  const filtered = query.trim()
    ? options.filter((o) => o.name.toLowerCase().includes(query.trim().toLowerCase()))
    : options;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? close() : openPicker())}
        className="inline-flex h-7 max-w-full items-center rounded-full px-2.5 font-mono text-[0.62rem] font-semibold uppercase tracking-[0.12em] outline-none transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
        style={{
          color: current ? current.colorHex : "var(--muted-foreground)",
          background: current ? `${current.colorHex}22` : "transparent",
          border: current ? "none" : "1px dashed var(--border)",
        }}
      >
        <span className="truncate">{current ? current.name : "— brak —"}</span>
      </button>

      {open && coords && typeof document !== "undefined" &&
        createPortal(
          <div
            ref={popRef}
            style={{
              position: "fixed",
              ...(coords.top !== undefined
                ? { top: coords.top }
                : { bottom: coords.bottom }),
              left: coords.left,
              width: 280,
              maxHeight: coords.maxHeight,
            }}
            className="z-[60] flex flex-col overflow-hidden rounded-xl border border-border bg-popover shadow-[0_18px_40px_-12px_rgba(10,10,40,0.3)]"
          >
            <div className="shrink-0 border-b border-border px-2.5 py-2">
              <div className="flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1">
                <Search size={11} className="text-muted-foreground" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Szukaj statusu…"
                  className="flex-1 bg-transparent text-[0.82rem] outline-none placeholder:text-muted-foreground/60"
                />
              </div>
            </div>

            <ReorderableList
              options={options}
              filtered={filtered}
              workspaceId={workspaceId}
              boardId={boardId}
              currentId={current?.id ?? null}
              canManageBoard={canManageBoard}
              editingId={editingId}
              setEditingId={setEditingId}
              isFiltered={query.trim().length > 0}
              adding={adding}
              onPick={pick}
            />

            {canManageBoard && (
              <div className="shrink-0 border-t border-border bg-popover">
                {adding ? (
                  <AddRow
                    workspaceId={workspaceId}
                    boardId={boardId}
                    onDone={() => setAdding(false)}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setAdding(true)}
                    className="flex w-full items-center gap-1.5 px-3 py-2 text-left font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    <Plus size={11} /> Dodaj status
                  </button>
                )}
              </div>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}

function Pill({ option }: { option: StatusOption }) {
  return (
    <span
      className="inline-flex h-6 items-center rounded-full px-2 font-mono text-[0.62rem] font-semibold uppercase tracking-[0.12em]"
      style={{ color: option.colorHex, background: `${option.colorHex}22` }}
    >
      {option.name}
    </span>
  );
}

function Empty() {
  return (
    <span className="font-mono text-[0.7rem] text-muted-foreground/60">—</span>
  );
}

function Row({
  option,
  isCurrent,
  canManage,
  canDelete,
  canReorder,
  onPick,
  onEdit,
  onDelete,
}: {
  option: StatusOption;
  isCurrent: boolean;
  canManage: boolean;
  canDelete: boolean;
  canReorder: boolean;
  onPick: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: option.id, disabled: !canReorder });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group flex items-center gap-1.5 rounded-md px-1 py-0.5 hover:bg-accent"
    >
      {canReorder && (
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Przeciągnij ${option.name}`}
          title="Przeciągnij aby zmienić kolejność"
          className="grid h-5 w-4 shrink-0 cursor-grab place-items-center rounded-sm text-muted-foreground/60 transition-colors hover:text-foreground active:cursor-grabbing"
        >
          <GripVertical size={11} />
        </button>
      )}
      <button
        type="button"
        onClick={onPick}
        className="flex flex-1 items-center gap-2 rounded-md py-1 pl-1.5 text-left"
      >
        <span
          className="grid h-3.5 w-3.5 shrink-0 place-items-center rounded-sm border"
          style={{
            borderColor: isCurrent ? option.colorHex : "var(--border)",
            background: isCurrent ? option.colorHex : "transparent",
          }}
        >
          {isCurrent && <Check size={9} className="text-white" strokeWidth={3} />}
        </span>
        <span
          className="inline-flex flex-1 items-center truncate rounded-full px-2 py-0.5 text-[0.74rem] font-semibold"
          style={{ color: option.colorHex, background: `${option.colorHex}22` }}
        >
          {option.name}
        </span>
      </button>
      {canManage && (
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Edytuj ${option.name}`}
          className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground group-hover:opacity-100"
        >
          <Pencil size={11} />
        </button>
      )}
      {canDelete && (
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Usuń ${option.name}`}
          className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
        >
          <X size={11} />
        </button>
      )}
    </div>
  );
}

function EditRow({
  workspaceId,
  option,
  onDone,
}: {
  workspaceId: string;
  option: StatusOption;
  onDone: () => void;
}) {
  const [name, setName] = useState(option.name);
  const [color, setColor] = useState(option.colorHex);
  const submit = () => {
    if (!name.trim()) return;
    const fd = new FormData();
    fd.set("workspaceId", workspaceId);
    fd.set("columnId", option.id);
    fd.set("name", name.trim());
    fd.set("colorHex", color);
    startTransition(async () => {
      await updateStatusColumnAction(fd);
      onDone();
    });
  };
  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-primary/40 bg-primary/5 p-2">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          } else if (e.key === "Escape") {
            onDone();
          }
        }}
        maxLength={40}
        className="rounded-sm border border-border bg-background px-1.5 py-0.5 text-[0.78rem] outline-none focus:border-primary/60"
      />
      <ColorRow selected={color} onChange={setColor} />
      <div className="flex items-center justify-end gap-1">
        <button
          type="button"
          onClick={onDone}
          className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
        >
          Anuluj
        </button>
        <button
          type="button"
          onClick={submit}
          className="inline-flex h-6 items-center rounded-md bg-primary px-2 font-mono text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-primary-foreground transition-opacity hover:opacity-90"
        >
          Zapisz
        </button>
      </div>
    </div>
  );
}

function AddRow({
  workspaceId,
  boardId,
  onDone,
}: {
  workspaceId: string;
  boardId: string;
  onDone: () => void;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const submit = () => {
    if (!name.trim()) return;
    const fd = new FormData();
    fd.set("workspaceId", workspaceId);
    fd.set("boardId", boardId);
    fd.set("name", name.trim());
    fd.set("colorHex", color);
    startTransition(async () => {
      await createStatusColumnAction(fd);
      onDone();
    });
  };
  return (
    <div className="flex flex-col gap-1.5 p-2">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          } else if (e.key === "Escape") {
            onDone();
          }
        }}
        placeholder="Nazwa statusu…"
        maxLength={40}
        className="rounded-sm border border-border bg-background px-1.5 py-1 text-[0.82rem] outline-none focus:border-primary/60"
      />
      <ColorRow selected={color} onChange={setColor} />
      <div className="flex items-center justify-end gap-1">
        <button
          type="button"
          onClick={onDone}
          className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
        >
          Anuluj
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={!name.trim()}
          className="inline-flex h-6 items-center rounded-md bg-primary px-2 font-mono text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          Dodaj
        </button>
      </div>
    </div>
  );
}

function ColorRow({
  selected,
  onChange,
}: {
  selected: string;
  onChange: (c: string) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      {PRESET_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          aria-label={`Kolor ${c}`}
          className="grid h-5 w-5 place-items-center rounded-full transition-transform hover:scale-110"
          style={{
            background: c,
            outline: selected === c ? "2px solid var(--foreground)" : "none",
            outlineOffset: selected === c ? 2 : 0,
          }}
        />
      ))}
    </div>
  );
}

// Wraps the visible Row list in a SortableContext + DndContext when the user
// can manage statuses and isn't filtering. Drag-end sends the new order to
// reorderStatusColumnsAction so it persists. We mirror the order locally for
// instant feedback — revalidate on the server then refreshes props.
function ReorderableList({
  options,
  filtered,
  workspaceId,
  boardId,
  currentId,
  canManageBoard,
  editingId,
  setEditingId,
  isFiltered,
  adding,
  onPick,
}: {
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
  // Optimistic mirror — keeps the dragged row in its new slot before the server
  // revalidate lands. Reset when the upstream options array changes (e.g.,
  // someone else reordered via the manage dialog).
  const [order, setOrder] = useState<StatusOption[]>(options);
  useEffect(() => {
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
    const oldIx = order.findIndex((s) => s.id === active.id);
    const newIx = order.findIndex((s) => s.id === over.id);
    if (oldIx < 0 || newIx < 0) return;
    const next = arrayMove(order, oldIx, newIx);
    setOrder(next);
    const fd = new FormData();
    fd.set("workspaceId", workspaceId);
    fd.set("boardId", boardId);
    fd.set("ids", next.map((s) => s.id).join(","));
    startTransition(() => reorderStatusColumnsAction(fd));
  };

  // While filtering, render the filtered slice without drag-handles.
  const visible = isFiltered
    ? filtered
    : (() => {
        const idIndex = new Map(order.map((s, i) => [s.id, i]));
        return [...filtered].sort(
          (a, b) => (idIndex.get(a.id) ?? 0) - (idIndex.get(b.id) ?? 0),
        );
      })();

  return (
    <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1">
      {visible.length === 0 && !adding && (
        <li className="px-2 py-3 text-center font-mono text-[0.62rem] uppercase tracking-[0.12em] text-muted-foreground/70">
          brak statusów
        </li>
      )}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <SortableContext
          items={visible.map((o) => o.id)}
          strategy={verticalListSortingStrategy}
        >
          {visible.map((o) => (
            <li key={o.id}>
              {editingId === o.id ? (
                <EditRow
                  workspaceId={workspaceId}
                  option={o}
                  onDone={() => setEditingId(null)}
                />
              ) : (
                <Row
                  option={o}
                  isCurrent={currentId === o.id}
                  canManage={canManageBoard}
                  canDelete={canManageBoard && options.length > 1}
                  canReorder={canReorder}
                  onPick={() => onPick(o.id)}
                  onEdit={() => setEditingId(o.id)}
                  onDelete={() => {
                    if (!confirm(`Usunąć status „${o.name}"?`)) return;
                    const fd = new FormData();
                    fd.set("workspaceId", workspaceId);
                    fd.set("columnId", o.id);
                    startTransition(() => deleteStatusColumnAction(fd));
                  }}
                />
              )}
            </li>
          ))}
        </SortableContext>
      </DndContext>
    </ul>
  );
}
