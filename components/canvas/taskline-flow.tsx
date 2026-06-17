"use client";

// F12-K73 v2: prawa strona widoku Task Line. ZERO whiteboard'a — nie
// używamy CanvasEditor, React Flow, edges, shape tools, color picker'a
// itd. To jest "kanban kafelek → następny kafelek → strzałka" linear
// flow.
//
// Layout:
//   - Empty: placeholder w środku obszaru "Dodaj pierwsze zadanie..."
//   - Z zadaniami: poziome kafelki + strzałki → na desktopie (flex-wrap),
//     pionowe kafelki + strzałki ↓ na mobile (flex-col).
//
// Interakcje:
//   - Drop z sidebar'a (MIME application/x-flovly-task-id) → append na koniec
//   - Drag karty wewnątrz flow → reorder (@dnd-kit/sortable)
//   - X na karcie → remove
//   - Right-click / long-press → menu z "Oznacz jako początkowe / końcowe"
//
// State management:
//   - Optimistic local items (sorted by .x)
//   - Server actions: append/reorder/remove/setFlowMark
//   - Po każdej akcji: lokalny state + tle wysyłka, rollback gdy server error

import { useMemo, useState, useTransition } from "react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronRight, ChevronDown, X, Flag, FlagOff, Square } from "lucide-react";
import {
  appendTaskToFlowAction,
  reorderTaskLineAction,
  removeFromFlowAction,
} from "@/app/(app)/w/[workspaceId]/c/taskline-actions";
import { setFlowMarkAction } from "@/app/(app)/w/[workspaceId]/c/actions";

export type TaskLineFlowItem = {
  id: string; // ProcessNode id
  taskId: string;
  taskTitle: string;
  statusName: string | null;
  statusColor: string | null;
  displayId: number | null;
  flowMark: "start" | "end" | null;
  x: number; // sort key (Float)
};

export type BoardTaskMeta = {
  id: string;
  title: string;
  statusName: string | null;
  statusColor: string | null;
  displayId: number;
};

export function TaskLineFlow({
  canvasId,
  initialItems,
  boardTasks,
  canEdit,
}: {
  canvasId: string;
  initialItems: TaskLineFlowItem[];
  boardTasks: Map<string, BoardTaskMeta>;
  canEdit: boolean;
}) {
  // Sort initial by x asc — pozycja w sequence.
  const [items, setItems] = useState<TaskLineFlowItem[]>(() =>
    [...initialItems].sort((a, b) => a.x - b.x),
  );
  const [, startTransition] = useTransition();
  const [dragHoverIdx, setDragHoverIdx] = useState<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const itemIds = useMemo(() => items.map((i) => i.id), [items]);

  // ─────────── Drop z sidebar'a ──────────────────────────────────────────

  const handleSidebarDrop = (e: React.DragEvent, insertAfterIdx: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDragHoverIdx(null);
    if (!canEdit) return;

    const taskId = e.dataTransfer.getData("application/x-flovly-task-id");
    if (!taskId) return;
    if (items.find((i) => i.taskId === taskId)) return; // dedup

    const meta = boardTasks.get(taskId);
    if (!meta) return;

    // Optimistic: dorzucamy tymczasowy kafelek. crypto.randomUUID jest
    // dostępny w przeglądarce + Node 16+, działa w event handler'ach.
    const tempId = `tmp-${crypto.randomUUID()}`;
    const prevX =
      insertAfterIdx >= 0
        ? items[insertAfterIdx].x
        : items.length > 0
          ? items[0].x - 1000
          : 0;
    const nextX =
      insertAfterIdx + 1 < items.length ? items[insertAfterIdx + 1].x : prevX + 1000;
    const newX = (prevX + nextX) / 2;

    const optimistic: TaskLineFlowItem = {
      id: tempId,
      taskId,
      taskTitle: meta.title,
      statusName: meta.statusName,
      statusColor: meta.statusColor,
      displayId: meta.displayId,
      flowMark: null,
      x: newX,
    };
    setItems((prev) =>
      [...prev.slice(0, insertAfterIdx + 1), optimistic, ...prev.slice(insertAfterIdx + 1)].sort(
        (a, b) => a.x - b.x,
      ),
    );

    startTransition(async () => {
      const result = await appendTaskToFlowAction({
        canvasId,
        taskId,
        insertAfterIndex: insertAfterIdx >= 0 ? insertAfterIdx : -1,
      });
      if (result.ok) {
        setItems((prev) =>
          prev.map((it) =>
            it.id === tempId ? { ...it, id: result.nodeId, x: result.x } : it,
          ),
        );
      } else {
        // Rollback.
        setItems((prev) => prev.filter((i) => i.id !== tempId));
      }
    });
  };

  // ─────────── Reorder (dnd-kit) ─────────────────────────────────────────

  const handleDragEnd = (e: DragEndEvent) => {
    if (!canEdit) return;
    const { active, over } = e;
    if (!over || active.id === over.id) return;

    const oldIdx = items.findIndex((i) => i.id === active.id);
    const newIdx = items.findIndex((i) => i.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;

    const next = arrayMove(items, oldIdx, newIdx);
    // Optimistic: nadajemy x = i*1000 lokalnie.
    setItems(next.map((it, i) => ({ ...it, x: i * 1000 })));

    startTransition(async () => {
      const result = await reorderTaskLineAction({
        canvasId,
        orderedNodeIds: next.map((it) => it.id),
      });
      if (!result.ok) {
        // Rollback — wracamy do poprzedniej kolejności.
        setItems(items);
      }
    });
  };

  // ─────────── Remove ────────────────────────────────────────────────────

  const handleRemove = (nodeId: string) => {
    if (!canEdit) return;
    const snapshot = items;
    setItems((prev) => prev.filter((i) => i.id !== nodeId));
    startTransition(async () => {
      const result = await removeFromFlowAction({ nodeId });
      if (!result.ok) {
        setItems(snapshot);
      }
    });
  };

  // ─────────── Flow mark (start / end / clear) ───────────────────────────

  const handleFlowMark = (nodeId: string, mark: "start" | "end" | null) => {
    if (!canEdit) return;
    const snapshot = items;
    setItems((prev) =>
      prev.map((i) => (i.id === nodeId ? { ...i, flowMark: mark } : i)),
    );
    startTransition(async () => {
      const result = await setFlowMarkAction({ canvasId, nodeId, mark });
      if (!result.ok) setItems(snapshot);
    });
  };

  // ─────────── Render ────────────────────────────────────────────────────

  if (items.length === 0) {
    return (
      <EmptyDropZone
        canEdit={canEdit}
        onDrop={(e) => handleSidebarDrop(e, -1)}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes("application/x-flovly-task-id")) {
            e.preventDefault();
            setDragHoverIdx(-1);
          }
        }}
        onDragLeave={() => setDragHoverIdx(null)}
        hovered={dragHoverIdx === -1}
      />
    );
  }

  return (
    <div className="flex h-full min-h-[420px] flex-col overflow-hidden">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={itemIds}
          // rectSorting działa równie dobrze dla pionowo i poziomo wrap'ujących
          // siatek — dnd-kit ogarnia oba dzięki rectangular hit testingowi.
          strategy={rectSortingStrategy}
        >
          <div
            className="flex flex-1 flex-wrap content-start items-stretch gap-2 overflow-y-auto p-4 max-md:flex-col max-md:items-stretch max-md:flex-nowrap"
            onDragOver={(e) => {
              if (e.dataTransfer.types.includes("application/x-flovly-task-id")) {
                e.preventDefault();
              }
            }}
            onDrop={(e) => handleSidebarDrop(e, items.length - 1)}
          >
            {items.map((item, i) => (
              <FlowSlot
                key={item.id}
                item={item}
                isLast={i === items.length - 1}
                onRemove={() => handleRemove(item.id)}
                onFlowMark={(m) => handleFlowMark(item.id, m)}
                onSidebarDropAfter={(e) => handleSidebarDrop(e, i)}
                canEdit={canEdit}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

// ─────────── FlowSlot: kafelek + strzałka za nim ───────────────────────────

function FlowSlot({
  item,
  isLast,
  onRemove,
  onFlowMark,
  onSidebarDropAfter,
  canEdit,
}: {
  item: TaskLineFlowItem;
  isLast: boolean;
  onRemove: () => void;
  onFlowMark: (mark: "start" | "end" | null) => void;
  onSidebarDropAfter: (e: React.DragEvent) => void;
  canEdit: boolean;
}) {
  const sortable = useSortable({ id: item.id, disabled: !canEdit });
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = sortable;

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div className="flex items-center gap-2 max-md:flex-col max-md:gap-1">
      <div ref={setNodeRef} style={style} {...attributes}>
        <TaskLineCard
          item={item}
          listeners={canEdit ? listeners : undefined}
          onRemove={onRemove}
          onFlowMark={onFlowMark}
          canEdit={canEdit}
        />
      </div>
      {/* Strzałka między kartami — ChevronRight na desktop, ChevronDown na mobile.
          Na ostatniej karcie pokazujemy "drop zone" zamiast strzałki — drop po
          tej karcie dodaje nowy task. */}
      {!isLast ? (
        <FlowArrow />
      ) : canEdit ? (
        <FlowDropZone onDrop={onSidebarDropAfter} />
      ) : null}
    </div>
  );
}

// ─────────── Card — kanban-style ──────────────────────────────────────────

function TaskLineCard({
  item,
  listeners,
  onRemove,
  onFlowMark,
  canEdit,
}: {
  item: TaskLineFlowItem;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  listeners?: any;
  onRemove: () => void;
  onFlowMark: (mark: "start" | "end" | null) => void;
  canEdit: boolean;
}) {
  const ring =
    item.flowMark === "start"
      ? "ring-2 ring-emerald-500/70 ring-offset-2 ring-offset-background"
      : item.flowMark === "end"
        ? "ring-2 ring-rose-500/70 ring-offset-2 ring-offset-background"
        : "";

  return (
    <div
      {...listeners}
      className={`group relative flex w-[240px] flex-col gap-2 rounded-xl border border-border bg-card p-3 shadow-sm transition-all hover:border-primary/40 hover:shadow-md max-md:w-full ${ring} ${canEdit ? "cursor-grab active:cursor-grabbing" : ""}`}
    >
      {/* Badge gdy start/end */}
      {item.flowMark === "start" && (
        <span className="absolute -top-2 left-3 rounded-full bg-emerald-500 px-2 py-0.5 font-mono text-[0.55rem] uppercase tracking-[0.16em] text-white shadow-sm">
          Start
        </span>
      )}
      {item.flowMark === "end" && (
        <span className="absolute -top-2 left-3 rounded-full bg-rose-500 px-2 py-0.5 font-mono text-[0.55rem] uppercase tracking-[0.16em] text-white shadow-sm">
          Koniec
        </span>
      )}

      {/* Górny wiersz: displayId + status pill + X */}
      <div className="flex items-center gap-2">
        {item.statusColor && (
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ background: item.statusColor }}
          />
        )}
        {item.displayId !== null && (
          <span className="font-mono text-[0.6rem] uppercase tracking-[0.12em] text-muted-foreground">
            #{item.displayId}
          </span>
        )}
        {item.statusName && (
          <span
            className="inline-flex items-center rounded-full px-1.5 font-mono text-[0.58rem] uppercase tracking-[0.1em]"
            style={{
              color: item.statusColor ?? "#94A3B8",
              background: `${item.statusColor ?? "#94A3B8"}1A`,
            }}
          >
            {item.statusName}
          </span>
        )}
        {canEdit && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label="Usuń z linii"
            title="Usuń z linii"
            className="ml-auto grid h-5 w-5 place-items-center rounded text-muted-foreground/0 transition-all group-hover:text-muted-foreground hover:!bg-rose-500/10 hover:!text-rose-500"
          >
            <X size={11} />
          </button>
        )}
      </div>

      {/* Tytuł zadania */}
      <div className="line-clamp-2 text-[0.88rem] font-semibold leading-tight text-foreground">
        {item.taskTitle}
      </div>

      {/* Flow mark mini-controls — kompaktowe, w stopce karty */}
      {canEdit && (
        <div className="flex items-center gap-1 border-t border-border/60 pt-2">
          <FlowMarkButton
            active={item.flowMark === "start"}
            onClick={(e) => {
              e.stopPropagation();
              onFlowMark(item.flowMark === "start" ? null : "start");
            }}
            color="emerald"
            icon={<Flag size={10} />}
            label="Start"
          />
          <FlowMarkButton
            active={item.flowMark === "end"}
            onClick={(e) => {
              e.stopPropagation();
              onFlowMark(item.flowMark === "end" ? null : "end");
            }}
            color="rose"
            icon={<Square size={10} />}
            label="Koniec"
          />
          {item.flowMark !== null && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onFlowMark(null);
              }}
              onPointerDown={(e) => e.stopPropagation()}
              title="Wyczyść oznaczenie"
              className="ml-auto grid h-5 w-5 place-items-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <FlagOff size={10} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function FlowMarkButton({
  active,
  onClick,
  color,
  icon,
  label,
}: {
  active: boolean;
  onClick: (e: React.MouseEvent) => void;
  color: "emerald" | "rose";
  icon: React.ReactNode;
  label: string;
}) {
  const activeCls =
    color === "emerald"
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      : "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300";
  return (
    <button
      type="button"
      onClick={onClick}
      onPointerDown={(e) => e.stopPropagation()}
      data-active={active ? "true" : "false"}
      title={`Oznacz jako ${label.toLowerCase()}`}
      className={`inline-flex h-6 items-center gap-1 rounded-md border border-border bg-background px-1.5 font-mono text-[0.58rem] uppercase tracking-[0.1em] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground ${active ? activeCls : ""}`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

// ─────────── Arrow + DropZone components ──────────────────────────────────

function FlowArrow() {
  return (
    <>
      {/* Desktop: → */}
      <span aria-hidden className="text-muted-foreground/60 max-md:hidden">
        <ChevronRight size={18} strokeWidth={2.5} />
      </span>
      {/* Mobile: ↓ */}
      <span aria-hidden className="text-muted-foreground/60 md:hidden">
        <ChevronDown size={18} strokeWidth={2.5} />
      </span>
    </>
  );
}

function FlowDropZone({ onDrop }: { onDrop: (e: React.DragEvent) => void }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("application/x-flovly-task-id")) {
          e.preventDefault();
          setHover(true);
        }
      }}
      onDragLeave={() => setHover(false)}
      onDrop={(e) => {
        setHover(false);
        onDrop(e);
      }}
      data-hover={hover ? "true" : "false"}
      className="grid h-[90px] w-[120px] place-items-center rounded-xl border border-dashed border-border/60 bg-card/30 text-[0.7rem] text-muted-foreground/60 transition-all data-[hover=true]:border-primary/60 data-[hover=true]:bg-primary/5 data-[hover=true]:text-foreground max-md:h-[60px] max-md:w-full"
    >
      + dodaj
    </div>
  );
}

// ─────────── EmptyDropZone — full-area drop target gdy lista pusta ────────

function EmptyDropZone({
  canEdit,
  onDrop,
  onDragOver,
  onDragLeave,
  hovered,
}: {
  canEdit: boolean;
  onDrop: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  hovered: boolean;
}) {
  return (
    <div
      onDrop={canEdit ? onDrop : undefined}
      onDragOver={canEdit ? onDragOver : undefined}
      onDragLeave={canEdit ? onDragLeave : undefined}
      data-hover={hovered ? "true" : "false"}
      className="flex h-full min-h-[420px] flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border/60 bg-card/30 px-6 text-center transition-all data-[hover=true]:border-primary/60 data-[hover=true]:bg-primary/5"
    >
      <div className="grid h-14 w-14 place-items-center rounded-full bg-brand-gradient text-white shadow-brand">
        <ChevronRight size={24} />
      </div>
      <h3 className="font-display text-[1.1rem] font-bold leading-tight tracking-[-0.02em] text-foreground">
        Dodaj pierwsze zadanie
      </h3>
      <p className="max-w-[36ch] text-[0.88rem] leading-[1.55] text-muted-foreground">
        Przeciągnij zadanie z listy po lewej, żeby utworzyć linię zadań. Kolejne
        kafelki połączą się w sekwencję &mdash; widoczny postęp pracy.
      </p>
    </div>
  );
}
