"use client";

import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Columns3,
  GripVertical,
  Plus,
} from "lucide-react";
import { createTaskAction } from "@/app/(app)/w/[workspaceId]/t/actions";
import {
  createStatusColumnAction,
  reorderStatusColumnsAction,
} from "@/app/(app)/w/[workspaceId]/b/[boardId]/actions";
import { PRESET_COLORS } from "@/components/table/status-column-manager";
import { TaskActivityHints } from "@/components/task/task-activity-hints";
import { PRIORITY_META } from "@/lib/task-priority";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  MouseSensor,
  PointerSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { patchTaskAction } from "@/app/(app)/w/[workspaceId]/t/actions";
import { useWorkspaceRealtime } from "@/hooks/use-workspace-realtime";
import {
  useAssignHotkey,
  type AssignMember,
} from "@/components/task/assign-hotkey";
import type { TaskPriorityValue } from "@/lib/task-priority";

// ══════════════════════════════════════════════════════════════════════════
// Typescript interfaces — DOKŁADNIE jak w poprzedniej wersji (zachowane).
// ══════════════════════════════════════════════════════════════════════════

export interface KanbanTask {
  id: string;
  title: string;
  statusColumnId: string | null;
  rowOrder: number;
  // F12-K75: priorytet zadania. NONE = badge ukryty.
  priority: TaskPriorityValue;
  startAt: string | null;
  stopAt: string | null;
  assignees: {
    id: string;
    name: string | null;
    email: string;
    avatarUrl: string | null;
  }[];
  tags: { id: string; name: string; colorHex: string }[];
  hasDescription: boolean;
  commentCount: number;
  subtaskCount: number;
  subtaskDoneCount: number;
  linkedCount: number;
  // F12-K128: liczba załączników task'a — wyświetlany badge w activity hints.
  attachmentCount: number;
}

export interface KanbanStatusColumn {
  id: string;
  name: string;
  colorHex: string;
}

// Synthetic "No status" column id used locally; tasks without a status
// land here. On drop we persist statusColumnId = null.
const NO_STATUS = "__none__";

// v4: konsystentne wymiary kolumn — 280 mobile, 300 desktop.
const COLUMN_W_BASE = "w-[280px]";
const COLUMN_W_MD = "md:w-[300px]";

// ══════════════════════════════════════════════════════════════════════════
// MAIN: KanbanBoard
// ══════════════════════════════════════════════════════════════════════════

export function KanbanBoard({
  workspaceId,
  boardId,
  statusColumns,
  initialTasks,
  members,
  canManageBoard,
}: {
  workspaceId: string;
  boardId: string;
  statusColumns: KanbanStatusColumn[];
  initialTasks: KanbanTask[];
  members: AssignMember[];
  canManageBoard: boolean;
}) {
  const assign = useAssignHotkey({ members, workspaceId });
  const [tasks, setTasks] = useState<KanbanTask[]>(initialTasks);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [, startPatch] = useTransition();
  useWorkspaceRealtime(workspaceId);

  // Resync local state when the server props change (revalidate). Guard against
  // resyncing mid-drag — a realtime broadcast from another user landing
  // between dragStart and dragEnd would otherwise yank the card back to its
  // original column under the cursor.
  const draggingRef = useRef(false);
  useEffect(() => {
    if (draggingRef.current) return;
    setTasks(initialTasks);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTasks.map((t) => `${t.id}:${t.statusColumnId ?? ""}:${t.rowOrder}`).join(",")]);

  const sensors = useSensors(
    // Mouse + touch handled separately so we can tune activation per input:
    // mouse fires after a tiny drag (4px) for snappy feel; touch needs a brief
    // press to disambiguate from scrolling. PointerSensor was the previous
    // single-sensor setup but it conflated both inputs.
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 6 },
    }),
    // Pen fallback.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    // Keyboard accessibility (WCAG 2.1.1): Space/Enter to pick up,
    // arrows to move, Space to drop, Esc to cancel.
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Hybrid collision: pointerWithin is precise inside columns (so dragging a
  // card over another card flags the over-card, not the parent column), and
  // rectIntersection is the fallback when the pointer is over the gap between
  // columns. Default closestCorners caused cards to "leap" between columns
  // before the pointer fully entered the new one.
  const collisionDetection: CollisionDetection = (args) => {
    const pointer = pointerWithin(args);
    if (pointer.length > 0) return pointer;
    return rectIntersection(args);
  };

  // Build column → ordered tasks map from the flat list.
  const columns = useMemo(() => {
    const map = new Map<string, KanbanTask[]>();
    for (const col of statusColumns) map.set(col.id, []);
    map.set(NO_STATUS, []);
    for (const t of tasks) {
      const key = t.statusColumnId ?? NO_STATUS;
      const list = map.get(key);
      if (list) list.push(t);
    }
    for (const list of map.values()) list.sort((a, b) => a.rowOrder - b.rowOrder);
    return map;
  }, [tasks, statusColumns]);

  const activeTask = activeId ? tasks.find((t) => t.id === activeId) ?? null : null;

  const findColumnIdOf = (taskId: string): string => {
    const t = tasks.find((x) => x.id === taskId);
    return t?.statusColumnId ?? NO_STATUS;
  };

  // When hovering another column, move the task into it locally so users
  // see the preview. We don't persist on drag over — only on drag end.
  const onDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;
    const activeTaskId = String(active.id);
    const overId = String(over.id);

    const activeCol = findColumnIdOf(activeTaskId);

    // Dropping over a column drop zone directly (ids prefixed col:).
    let overCol: string | null = null;
    if (overId.startsWith("col:")) overCol = overId.slice(4);
    else {
      const overTask = tasks.find((x) => x.id === overId);
      if (overTask) overCol = overTask.statusColumnId ?? NO_STATUS;
    }
    if (!overCol || overCol === activeCol) return;

    // Move the task visually into the new column at the end (or at the
    // over-task position). Persist happens in onDragEnd.
    setTasks((prev) => {
      const next = [...prev];
      const idx = next.findIndex((x) => x.id === activeTaskId);
      if (idx === -1) return prev;
      next[idx] = {
        ...next[idx],
        statusColumnId: overCol === NO_STATUS ? null : overCol,
      };
      return next;
    });
  };

  const onDragStart = (event: DragStartEvent) => {
    draggingRef.current = true;
    setActiveId(String(event.active.id));
  };

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    draggingRef.current = false;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    const activeTask = tasks.find((t) => t.id === activeId);
    if (!activeTask) return;

    // Resolve target column + position
    let targetColId: string;
    let targetIndex: number;

    if (overId.startsWith("col:")) {
      targetColId = overId.slice(4);
      const colTasks = columns.get(targetColId) ?? [];
      targetIndex = colTasks.length;
    } else {
      const overTask = tasks.find((x) => x.id === overId);
      if (!overTask) return;
      targetColId = overTask.statusColumnId ?? NO_STATUS;
      const colTasks = columns.get(targetColId) ?? [];
      const curIdx = colTasks.findIndex((t) => t.id === activeId);
      const overIdx = colTasks.findIndex((t) => t.id === overId);
      targetIndex = curIdx === -1 ? overIdx + 1 : overIdx;
    }

    const targetTasks = columns.get(targetColId) ?? [];
    const withoutActive = targetTasks.filter((t) => t.id !== activeId);
    const prev = targetIndex > 0 ? withoutActive[targetIndex - 1] : null;
    const next = targetIndex < withoutActive.length ? withoutActive[targetIndex] : null;

    const newRowOrder =
      prev && next
        ? (prev.rowOrder + next.rowOrder) / 2
        : prev
          ? prev.rowOrder + 1
          : next
            ? next.rowOrder / 2
            : 1;

    const newStatusColumnId = targetColId === NO_STATUS ? null : targetColId;

    if (
      activeTask.statusColumnId === newStatusColumnId &&
      activeTask.rowOrder === newRowOrder
    ) {
      return;
    }

    // Optimistic state already reflects the move done in onDragOver;
    // reorder within the column here.
    setTasks((prevState) => {
      const arr = [...prevState];
      const ix = arr.findIndex((t) => t.id === activeId);
      if (ix === -1) return prevState;
      arr[ix] = { ...arr[ix], statusColumnId: newStatusColumnId, rowOrder: newRowOrder };
      return arr;
    });

    // Persist
    const fd = new FormData();
    fd.set("id", activeId);
    fd.set("statusColumnId", newStatusColumnId ?? "");
    fd.set("rowOrder", String(newRowOrder));
    startPatch(() => {
      patchTaskAction(fd);
    });
  };

  // Render columns — in order of statusColumns + No Status at the end if it has items.
  const renderColumns: { id: string; column: KanbanStatusColumn | null }[] = [
    ...statusColumns.map((c) => ({ id: c.id, column: c })),
  ];
  if ((columns.get(NO_STATUS)?.length ?? 0) > 0) {
    renderColumns.push({ id: NO_STATUS, column: null });
  }

  // v4 internal header — "+ Zadanie" gradient button triggers the first
  // column's inline-add. Each InlineAddTask registers its opener via this
  // ref-of-callbacks map, keyed by column id. "Kolumny" ghost button scrolls
  // the column rail to the end so the AddKanbanColumnButton trigger is in view.
  const railRef = useRef<HTMLDivElement>(null);
  const openersRef = useRef<Map<string, () => void>>(new Map());
  const registerOpener = useCallback(
    (colId: string, opener: (() => void) | null) => {
      if (opener) openersRef.current.set(colId, opener);
      else openersRef.current.delete(colId);
    },
    [],
  );
  const firstAddableColId = renderColumns.find((rc) => rc.id !== NO_STATUS)?.id ?? null;
  const handleHeaderAddTask = () => {
    if (!firstAddableColId) return;
    const opener = openersRef.current.get(firstAddableColId);
    opener?.();
  };
  const handleHeaderColumns = () => {
    const rail = railRef.current;
    if (!rail) return;
    rail.scrollTo({ left: rail.scrollWidth, behavior: "smooth" });
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      // Force re-measurement of droppable rects on every layout change. Without
      // this, columns whose card list grew/shrank during a drag kept their
      // pre-drag bounds and the cursor "snapped past" them.
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      // WCAG 2.1.1 — keyboard DnD announcements + instructions for screen readers.
      accessibility={{
        announcements: {
          onDragStart({ active }) {
            return `Podniesiono zadanie ${active.id}`;
          },
          onDragOver({ active, over }) {
            if (over) return `Zadanie ${active.id} nad ${over.id}`;
            return undefined;
          },
          onDragEnd({ active, over }) {
            if (over) return `Upuszczono zadanie ${active.id} na ${over.id}`;
            return `Anulowano przeniesienie zadania ${active.id}`;
          },
          onDragCancel({ active }) {
            return `Anulowano przeniesienie zadania ${active.id}`;
          },
        },
        screenReaderInstructions: {
          draggable:
            "Naciśnij Space lub Enter aby podnieść. Strzałki aby przenieść. Space aby upuścić. Esc aby anulować.",
        },
      }}
    >
      {/* v4: Kontener kanbanu = jedna karta glass rounded-[22px] z brand-tinted
          shadow. Wewnątrz: internal header + rail kolumn.
          BoardHeader pozostaje NA ZEWNĄTRZ tej karty — to jest osobny element. */}
      <div className="relative overflow-hidden rounded-[22px] border border-border/60 bg-card/60 shadow-aura backdrop-blur-md dark:border-white/[0.07] dark:bg-white/[0.04]">
        {/* INTERNAL HEADER — v4 calendar-style row: title eyebrow left,
            actions right ("Kolumny" ghost + "+ Zadanie" gradient). */}
        <div className="flex items-center justify-between gap-3 border-b border-border/60 bg-white/[0.02] px-4 py-3 dark:border-white/[0.06] dark:bg-white/[0.02]">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="h-2 w-2 shrink-0 rounded-full bg-brand-gradient"
              aria-hidden
            />
            <span className="truncate font-mono text-[0.68rem] uppercase tracking-[0.14em] text-muted-foreground">
              Workspace · Kanban
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {canManageBoard && (
              <button
                type="button"
                onClick={handleHeaderColumns}
                className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border/60 bg-transparent px-2.5 font-mono text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:border-primary/40 hover:bg-white/[0.04] hover:text-foreground dark:border-white/[0.10] dark:hover:bg-white/[0.04]"
                aria-label="Przewiń do zarządzania kolumnami"
              >
                <Columns3 size={12} strokeWidth={2} />
                <span>Kolumny</span>
              </button>
            )}
            {firstAddableColId && (
              <button
                type="button"
                onClick={handleHeaderAddTask}
                className="inline-flex h-7 items-center gap-1.5 rounded-md bg-brand-gradient px-2.5 font-mono text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-white shadow-brand transition-opacity hover:opacity-95"
                aria-label="Dodaj zadanie do pierwszej kolumny"
              >
                <Plus size={12} strokeWidth={2.4} />
                <span>Zadanie</span>
              </button>
            )}
          </div>
        </div>

        {/* RAIL — horizontal flex z scroll-snap na mobile dla swipe między
            kolumnami. gap-3 mobile / gap-3.5 desktop trzyma się referencji
            (13px gap). Padding wewnątrz karty (16px = p-4). */}
        <div
          ref={railRef}
          className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 pt-4 md:snap-none md:gap-3.5"
        >
          {renderColumns.map(({ id, column }) => {
            const colTasks = columns.get(id) ?? [];
            // NO_STATUS is virtual (not in DB) — exclude from reorder.
            const realColumns = renderColumns.filter((rc) => rc.id !== NO_STATUS);
            const realIdx = realColumns.findIndex((rc) => rc.id === id);
            return (
              <Column
                key={id}
                id={id}
                column={column}
                tasks={colTasks}
                workspaceId={workspaceId}
                boardId={boardId}
                canReorder={canManageBoard && id !== NO_STATUS}
                isFirstReal={realIdx === 0}
                isLastReal={realIdx === realColumns.length - 1}
                realColumnIds={realColumns.map((rc) => rc.id)}
                registerOpener={registerOpener}
                getHotkeyProps={(t) =>
                  assign.rowProps(
                    t.id,
                    t.assignees.map((a) => a.id),
                  )
                }
              />
            );
          })}
          {canManageBoard && (
            <AddKanbanColumnButton workspaceId={workspaceId} boardId={boardId} />
          )}
        </div>

        {/* FOOTER hint — jak w v4 referencji każda board-view karta ma hint. */}
        <div className="border-t border-border/60 bg-white/[0.02] px-4 py-2.5 dark:border-white/[0.06] dark:bg-white/[0.02]">
          <span className="font-mono text-[0.66rem] text-muted-foreground/70">
            Hint · przeciągnij kartę między kolumnami aby zmienić status
          </span>
        </div>
      </div>
      {/* Portal DragOverlay pod document.body: DragOverlay używa position: fixed
          + transform translate3d() do śledzenia kursora, ale `position: fixed`
          staje się "fixed wzgl. transformed ancestor", jeśli któryś z rodziców
          ma transform / filter / backdrop-filter. Skutek bez portalu: karta
          wyświetla się daleko od kursora (klient: "wyskakuje na prawo"). Portal
          przenosi node bezpośrednio pod body — żaden ancestor go już nie dotyka. */}
      {typeof document !== "undefined" &&
        createPortal(
          <DragOverlay>
            {activeTask ? (
              <CardShell task={activeTask} workspaceId={workspaceId} dragging />
            ) : null}
          </DragOverlay>,
          document.body,
        )}
      {assign.menu}
    </DndContext>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// COLUMN — v4: glass-surface kolumna z grip-handle + color-dot + count.
// Sticky header zostaje (sticky top-0 wewnątrz overflow body).
// ══════════════════════════════════════════════════════════════════════════

function Column({
  id,
  column,
  tasks,
  workspaceId,
  boardId,
  canReorder,
  isFirstReal,
  isLastReal,
  realColumnIds,
  registerOpener,
  getHotkeyProps,
}: {
  id: string;
  column: KanbanStatusColumn | null;
  tasks: KanbanTask[];
  workspaceId: string;
  boardId: string;
  canReorder?: boolean;
  isFirstReal?: boolean;
  isLastReal?: boolean;
  realColumnIds?: string[];
  registerOpener?: (colId: string, opener: (() => void) | null) => void;
  getHotkeyProps?: (task: KanbanTask) => {
    onMouseEnter: () => void;
    onMouseLeave: () => void;
  };
}) {
  const color = column?.colorHex ?? "#94A3B8";
  const name = column?.name ?? "Bez statusu";
  // Bez statusu column can't be added to — no statusColumnId for the server action.
  const canAddInline = id !== NO_STATUS;

  const moveLeft = () => {
    if (!realColumnIds || isFirstReal) return;
    const fromIdx = realColumnIds.indexOf(id);
    if (fromIdx <= 0) return;
    const next = [...realColumnIds];
    [next[fromIdx - 1], next[fromIdx]] = [next[fromIdx], next[fromIdx - 1]];
    const fd = new FormData();
    fd.set("workspaceId", workspaceId);
    fd.set("boardId", boardId);
    fd.set("ids", next.join(","));
    startTransition(() => reorderStatusColumnsAction(fd));
  };

  const moveRight = () => {
    if (!realColumnIds || isLastReal) return;
    const fromIdx = realColumnIds.indexOf(id);
    if (fromIdx < 0 || fromIdx >= realColumnIds.length - 1) return;
    const next = [...realColumnIds];
    [next[fromIdx], next[fromIdx + 1]] = [next[fromIdx + 1], next[fromIdx]];
    const fd = new FormData();
    fd.set("workspaceId", workspaceId);
    fd.set("boardId", boardId);
    fd.set("ids", next.join(","));
    startTransition(() => reorderStatusColumnsAction(fd));
  };

  return (
    <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
      {/* v4: kolumna = glass surface, rounded-[15px] (z designu), border subtle.
          flex-col z body który scrolluje samodzielnie (header sticky).
          Spec: bg-white/3 + border-white/7 + backdrop-blur. */}
      <div
        role="group"
        aria-label={`Kolumna ${name}, ${tasks.length} ${tasks.length === 1 ? "zadanie" : "zadań"}`}
        className={`group/col flex ${COLUMN_W_BASE} ${COLUMN_W_MD} shrink-0 snap-start flex-col overflow-hidden rounded-[15px] border border-border/50 bg-white/[0.03] md:snap-none dark:border-white/[0.07] dark:bg-white/[0.04]`}
      >
        {/* HEADER — sticky w obrębie kolumny.
            Layout: grip-icon (drag/reorder visual cue) + color-dot + nazwa (bold) +
            count (mała szara) + chevrons reorder z prawej. */}
        <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-white/[0.07] bg-card/95 px-3 py-3 shadow-[0_1px_0_0_rgba(0,0,0,0.04)] dark:border-white/[0.07] dark:bg-card/95">
          {/* Grip icon — 6 kropek z designu, czysto wizualny (sygnał reorder) */}
          <GripVertical
            size={13}
            className="shrink-0 text-muted-foreground/40"
            aria-hidden
          />
          {/* Color dot — 8px z designu */}
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ background: color }}
            aria-hidden
          />
          {/* Nazwa — bold 13px z designu */}
          <span className="truncate font-display text-[0.81rem] font-bold leading-none text-foreground">
            {name}
          </span>
          {/* Count — drobny szary, font-mono dla numeric tabular */}
          <span className="shrink-0 font-mono text-[0.69rem] tabular-nums text-muted-foreground/70">
            {tasks.length}
          </span>
          {/* Reorder chevrons — w prawym rogu (ml-auto) */}
          {canReorder && realColumnIds && realColumnIds.length > 1 ? (
            <div className="ml-auto flex items-center gap-0.5">
              <button
                type="button"
                onClick={moveLeft}
                disabled={isFirstReal}
                aria-label="Przesuń kolumnę w lewo"
                title="Przesuń kolumnę w lewo"
                className="grid h-5 w-5 place-items-center rounded-md text-muted-foreground/60 transition-colors hover:bg-white/[0.06] hover:text-foreground disabled:cursor-not-allowed disabled:opacity-25 disabled:hover:bg-transparent dark:hover:bg-white/[0.06]"
              >
                <ChevronLeft size={12} />
              </button>
              <button
                type="button"
                onClick={moveRight}
                disabled={isLastReal}
                aria-label="Przesuń kolumnę w prawo"
                title="Przesuń kolumnę w prawo"
                className="grid h-5 w-5 place-items-center rounded-md text-muted-foreground/60 transition-colors hover:bg-white/[0.06] hover:text-foreground disabled:cursor-not-allowed disabled:opacity-25 disabled:hover:bg-transparent dark:hover:bg-white/[0.06]"
              >
                <ChevronRight size={12} />
              </button>
            </div>
          ) : (
            // Placeholder żeby header trzymał równą wysokość bez reorder.
            <ChevronsUpDown
              size={12}
              className="ml-auto shrink-0 text-muted-foreground/30"
              aria-hidden
            />
          )}
        </div>

        {/* BODY — scroll container.
            v4: padding 10px (≈ p-2.5), gap 9px (gap-2.5) — z referencji. */}
        <ColumnDropZone id={id}>
          <div role="list" className="flex min-h-[60px] flex-1 flex-col gap-2.5 overflow-y-auto p-2.5">
            {tasks.map((t) => (
              <SortableCard
                key={t.id}
                task={t}
                workspaceId={workspaceId}
                hotkeyProps={getHotkeyProps?.(t)}
              />
            ))}
            {/* EMPTY STATE — dashed brand-tinted border, "Upuść tutaj" copy z v4. */}
            {tasks.length === 0 && (
              <div className="rounded-xl border border-dashed border-primary/30 bg-primary/[0.06] px-3 py-4 text-center text-[0.72rem] font-medium text-muted-foreground">
                Upuść tutaj
              </div>
            )}
            {/* INLINE ADD TASK — render po liście, na końcu body.
                Pierwsza kolumna rejestruje swój opener pod registerOpener —
                header "+ Zadanie" wywoła go aby otworzyć editor. */}
            {canAddInline && (
              <InlineAddTask
                workspaceId={workspaceId}
                boardId={boardId}
                statusColumnId={id}
                registerOpener={
                  isFirstReal && registerOpener
                    ? (open) => registerOpener(id, open)
                    : undefined
                }
              />
            )}
          </div>
        </ColumnDropZone>
      </div>
    </SortableContext>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// COLUMN DROP ZONE — pełne body kolumny jako drop target.
// ══════════════════════════════════════════════════════════════════════════

function ColumnDropZone({ id, children }: { id: string; children: React.ReactNode }) {
  // Entire column is a drop target. Prefix "col:" so onDragOver/onDragEnd
  // can distinguish column hits from card-on-card hits.
  const { setNodeRef, isOver } = useDroppable({ id: `col:${id}` });
  return (
    <div
      ref={setNodeRef}
      className={`flex flex-1 flex-col transition-colors ${
        isOver ? "bg-primary/[0.04]" : ""
      }`}
    >
      {children}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// INLINE ADD TASK — v4: ghost button "+ Nowe zadanie" na dnie body kolumny.
// ══════════════════════════════════════════════════════════════════════════

function InlineAddTask({
  workspaceId,
  boardId,
  statusColumnId,
  registerOpener,
}: {
  workspaceId: string;
  boardId: string;
  statusColumnId: string;
  registerOpener?: (open: (() => void) | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  // Pierwsza kolumna rejestruje swój opener — header "+ Zadanie" wywoła go.
  useEffect(() => {
    if (!registerOpener) return;
    const open = () => setEditing(true);
    registerOpener(open);
    return () => registerOpener(null);
  }, [registerOpener]);
  const submit = () => {
    const trimmed = title.trim();
    if (!trimmed) {
      setEditing(false);
      return;
    }
    const fd = new FormData();
    fd.set("workspaceId", workspaceId);
    fd.set("boardId", boardId);
    fd.set("title", trimmed);
    fd.set("statusColumnId", statusColumnId);
    startTransition(async () => {
      await createTaskAction(null, fd);
      setTitle("");
      // Stay in edit mode — fire many in a row.
    });
  };
  if (!editing) {
    // v4: "+ Nowe zadanie" ghost row na dnie kolumny.
    // gap-2 px-3 py-2 muted, hover brand-light (primary tint).
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="mt-1 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-left text-[0.78rem] font-medium text-muted-foreground transition-colors hover:bg-primary/[0.08] hover:text-primary dark:hover:bg-primary/[0.10]"
      >
        <Plus size={14} strokeWidth={2} />
        <span>Nowe zadanie</span>
      </button>
    );
  }
  return (
    // Edit mode — ramka brand-tinted, focused input.
    <div className="flex flex-col gap-1.5 rounded-xl border border-primary/40 bg-card p-2.5 shadow-[0_8px_18px_-10px_rgba(124,92,255,0.25)]">
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          } else if (e.key === "Escape") {
            setTitle("");
            setEditing(false);
          }
        }}
        maxLength={200}
        placeholder="Tytuł zadania…"
        className="w-full bg-transparent text-[0.86rem] outline-none placeholder:text-muted-foreground/50"
      />
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            setTitle("");
            setEditing(false);
          }}
          className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground"
        >
          Anuluj
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={!title.trim()}
          className="inline-flex h-6 items-center rounded-md bg-primary px-2.5 font-mono text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          Dodaj
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// SORTABLE CARD — wrapper z dnd-kit useSortable.
// ══════════════════════════════════════════════════════════════════════════

function SortableCard({
  task,
  workspaceId,
  hotkeyProps,
}: {
  task: KanbanTask;
  workspaceId: string;
  hotkeyProps?: {
    onMouseEnter: () => void;
    onMouseLeave: () => void;
  };
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id });

  return (
    // Outer wrapper carries role="listitem" so the column body (role="list")
    // has a proper listitem children. Inner div is the dnd-kit draggable —
    // its spread `attributes` inject role="button" which we don't override.
    <div role="listitem">
      <div
        ref={setNodeRef}
        style={{
          transform: CSS.Transform.toString(transform),
          transition,
          // v4: drag state — opacity 0.5 + scale 0.98 (delikatne "wycofanie" karty).
          opacity: isDragging ? 0.5 : 1,
          scale: isDragging ? "0.98" : "1",
        }}
        {...attributes}
        {...listeners}
      >
        <CardShell task={task} workspaceId={workspaceId} hotkeyProps={hotkeyProps} />
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// CARD SHELL — wizualna kartka z designu v4.
// Layout:
//  1. Tags row (max 4)
//  2. Priority badge (jeśli != NONE)
//  3. Title (line-clamp-3, semibold, hover → primary)
//  4. TaskActivityHints (description/comments/subtasks/linked)
//  5. Meta: avatars stacked (max 3) + stopAt date pill
// ══════════════════════════════════════════════════════════════════════════

function CardShell({
  task,
  workspaceId,
  dragging,
  hotkeyProps,
}: {
  task: KanbanTask;
  workspaceId: string;
  dragging?: boolean;
  hotkeyProps?: {
    onMouseEnter: () => void;
    onMouseLeave: () => void;
  };
}) {
  // v4: due pill ma 3 stany — overdue/today/future. Każdy własna paleta.
  const dueState = useMemo<"overdue" | "today" | "future" | null>(() => {
    if (!task.stopAt) return null;
    const stop = new Date(task.stopAt);
    stop.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (stop.getTime() < today.getTime()) return "overdue";
    if (stop.getTime() === today.getTime()) return "today";
    return "future";
  }, [task.stopAt]);

  // v4: priorytet → 7x7 kropka kolorowa obok tytułu. Reuse PRIORITY_META.dotColor.
  const priorityDot = task.priority !== "NONE" ? PRIORITY_META[task.priority].dotColor : null;

  const extraAssignees = Math.max(0, task.assignees.length - 3);

  return (
    <article
      {...(hotkeyProps ?? {})}
      className={[
        // v4: rounded-[13px], glass surface (bg-white/5, border-white/10),
        // p-3. Light mode override przez non-dark fallback z bg-card.
        "group/card flex cursor-grab flex-col gap-2 rounded-[13px] border border-border/60 bg-card p-3",
        "dark:border-white/[0.10] dark:bg-white/[0.05]",
        // v4: shadow 0 8px 18px -10px black (low-opacity drop shadow, jak w referencji).
        "shadow-[0_8px_18px_-10px_rgba(46,19,52,0.12)] dark:shadow-[0_8px_18px_-10px_rgba(0,0,0,0.5)]",
        // Hover: translate-y i glow (tylko transform + box-shadow — żadnego transition-all).
        "transition-[transform,box-shadow,border-color] duration-200 ease-out",
        "hover:-translate-y-px hover:border-primary/30 hover:shadow-[0_12px_26px_-10px_rgba(124,92,255,0.28)] dark:hover:border-primary/40",
        "active:cursor-grabbing",
        // Drag state — silniejsza ramka + ring.
        dragging
          ? "ring-2 ring-primary/50 shadow-[0_20px_32px_-12px_rgba(124,92,255,0.45)]"
          : "",
      ].join(" ")}
    >
      {/* ROW 1 — TAGS (max 4) — v4: małe pille z color tint background. */}
      {task.tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          {task.tags.slice(0, 4).map((t) => (
            <span
              key={t.id}
              className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[0.66rem] font-medium leading-none"
              style={{ background: `${t.colorHex}1A`, color: t.colorHex }}
            >
              {t.name}
            </span>
          ))}
          {task.tags.length > 4 && (
            <span className="text-[0.62rem] text-muted-foreground/70">
              +{task.tags.length - 4}
            </span>
          )}
        </div>
      )}

      {/* ROW 2 — TITLE z inline priority dot 7x7 z LEWEJ (v4 mid row).
          line-clamp-3 z designu (3 linie max, potem ellipsis).
          hyphens-auto + lang="pl" → soft hyphen na polskich wyrazach przed
          break-words. hover:text-primary jak link standard. */}
      <div className="flex items-start gap-2">
        {priorityDot ? (
          <span
            className="mt-[5px] h-[7px] w-[7px] shrink-0 rounded-full"
            style={{ background: priorityDot }}
            aria-label={PRIORITY_META[task.priority].label}
            title={PRIORITY_META[task.priority].label}
          />
        ) : null}
        <Link
          href={`/w/${workspaceId}/t/${task.id}`}
          onPointerDown={(e) => e.stopPropagation()}
          lang="pl"
          className="font-display text-[0.81rem] font-semibold leading-snug tracking-[-0.005em] text-pretty break-words hyphens-auto text-foreground transition-colors hover:text-primary line-clamp-3 pr-0.5"
        >
          {task.title}
        </Link>
      </div>

      {/* ROW 4 — ACTIVITY HINTS (description, comments, subtasks, linked).
          ZACHOWANY komponent TaskActivityHints. */}
      <TaskActivityHints
        hasDescription={task.hasDescription}
        commentCount={task.commentCount}
        subtaskCount={task.subtaskCount}
        subtaskDoneCount={task.subtaskDoneCount}
        linkedCount={task.linkedCount}
        attachmentCount={task.attachmentCount}
      />

      {/* ROW 5 — META row: avatars left, stopAt pill right.
          v4: margin-top 11px (mt-[11px]). mt-auto utrzymuje pin do dołu
          gdy karty mają różną wysokość — łączymy oba. */}
      <div className="mt-auto flex items-center justify-between gap-2 pt-[3px]">
        {task.assignees.length > 0 ? (
          <div className="flex items-center -space-x-1.5">
            {task.assignees.slice(0, 3).map((a) => (
              <span
                key={a.id}
                title={a.name ?? a.email}
                className="grid h-[22px] w-[22px] place-items-center overflow-hidden rounded-md border-2 border-card bg-brand-gradient font-display text-[0.55rem] font-bold text-white dark:border-[#0C0A14]"
              >
                {a.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.avatarUrl} alt="" width={22} height={22} className="h-full w-full object-cover" />
                ) : (
                  (a.name ?? a.email).slice(0, 2).toUpperCase()
                )}
              </span>
            ))}
            {extraAssignees > 0 && (
              <span
                className="grid h-[22px] min-w-[22px] place-items-center rounded-md border-2 border-card bg-muted px-1 font-mono text-[0.56rem] font-bold text-muted-foreground dark:border-[#0C0A14]"
                title={`+${extraAssignees} więcej`}
              >
                +{extraAssignees}
              </span>
            )}
          </div>
        ) : (
          <span />
        )}
        {task.stopAt && dueState && (
          <span
            className={[
              // v4: rounded-full px-2 py-0.5, 3-state palette.
              "inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[0.65rem] font-semibold uppercase tabular-nums tracking-[0.04em]",
              dueState === "overdue"
                ? "bg-rose-500/15 text-rose-500 dark:bg-rose-400/15 dark:text-rose-300"
                : dueState === "today"
                  ? "bg-amber-500/15 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300"
                  : "bg-primary/[0.10] text-primary dark:bg-primary/[0.14]",
            ].join(" ")}
          >
            {new Date(task.stopAt).toLocaleDateString("pl-PL", {
              month: "short",
              day: "numeric",
            })}
          </span>
        )}
      </div>
    </article>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// ADD KANBAN COLUMN BUTTON — "+ Dodaj kolumnę" trigger + popover.
// Mirrors AddColumnButton in board-table.tsx; creates a StatusColumn.
// ══════════════════════════════════════════════════════════════════════════

function AddKanbanColumnButton({
  workspaceId,
  boardId,
}: {
  workspaceId: string;
  boardId: string;
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{
    placement: "below" | "above";
    top?: number;
    bottom?: number;
    left: number;
    maxHeight: number;
  } | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(PRESET_COLORS[0]);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  const closeReset = () => {
    setName("");
    setColor(PRESET_COLORS[0]);
    setOpen(false);
    setCoords(null);
  };

  // Use CSS top/bottom anchors so above-mode stays adjacent to the trigger (not floating high up).
  const computeCoords = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const POP_WIDTH = 320;
    const POP_MAX_HEIGHT = 420;
    const GAP = 6;
    const PAGE_PAD = 16;
    const spaceBelow = window.innerHeight - rect.bottom - GAP - PAGE_PAD;
    const spaceAbove = rect.top - GAP - PAGE_PAD;
    const wantBelow = spaceBelow >= 280 || spaceBelow >= spaceAbove;
    const maxHeight = Math.min(POP_MAX_HEIGHT, Math.max(220, wantBelow ? spaceBelow : spaceAbove));
    const left = Math.max(8, Math.min(window.innerWidth - POP_WIDTH - 8, rect.left));
    return wantBelow
      ? { placement: "below" as const, top: rect.bottom + GAP, left, maxHeight }
      : { placement: "above" as const, bottom: window.innerHeight - rect.top + GAP, left, maxHeight };
  };

  const openWithCoords = () => {
    const c = computeCoords();
    if (!c) return;
    setCoords(c);
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (
        !popRef.current?.contains(e.target as globalThis.Node) &&
        !triggerRef.current?.contains(e.target as globalThis.Node)
      ) {
        closeReset();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeReset();
    };
    const onReflow = () => {
      const c = computeCoords();
      if (c) setCoords(c);
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

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const fd = new FormData();
    fd.set("workspaceId", workspaceId);
    fd.set("boardId", boardId);
    fd.set("name", trimmed);
    fd.set("colorHex", color);
    startTransition(async () => {
      await createStatusColumnAction(fd);
      closeReset();
    });
  };

  return (
    <>
      {/* v4: self-start + fixed height żeby trigger nie rozciągał się do wysokości
          kolumn. Trigger dopasowany do v4 estetyki — dashed border, glass tint. */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? closeReset() : openWithCoords())}
        aria-label="Dodaj kolumnę"
        className={`inline-flex h-[52px] ${COLUMN_W_BASE} ${COLUMN_W_MD} shrink-0 snap-start self-start items-center justify-center gap-2 rounded-[15px] border border-dashed border-white/[0.12] bg-white/[0.02] px-3 text-[0.78rem] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:bg-white/[0.04] hover:text-foreground dark:border-white/[0.12] dark:bg-white/[0.02]`}
      >
        <Plus size={14} strokeWidth={2} />
        <span>Dodaj kolumnę</span>
      </button>
      {open && coords && typeof document !== "undefined" &&
        createPortal(
          <div
            ref={popRef}
            style={{
              position: "fixed",
              ...(coords.placement === "below"
                ? { top: coords.top }
                : { bottom: coords.bottom }),
              left: coords.left,
              width: 320,
              maxHeight: coords.maxHeight,
            }}
            // z-[200] === Z.popoverInModal (F12-K104).
            className="z-[200] flex flex-col overflow-hidden rounded-xl border border-border bg-popover shadow-[0_18px_40px_-12px_rgba(10,10,40,0.3)]"
          >
            <div className="shrink-0 border-b border-border px-3 py-2">
              <p className="eyebrow">Nowa kolumna</p>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && name.trim()) {
                    e.preventDefault();
                    submit();
                  }
                }}
                maxLength={40}
                placeholder="Nazwa kolumny…"
                className="mb-3 w-full rounded-md border border-border bg-background px-2 py-1.5 text-[0.86rem] outline-none focus-visible:border-primary/60 focus-visible:ring-2 focus-visible:ring-primary/40"
              />
              <p className="mb-1.5 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground/80">
                Kolor
              </p>
              <div className="grid grid-cols-8 gap-1.5">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    aria-label={`Kolor ${c}`}
                    className="h-7 w-7 rounded-full ring-1 ring-foreground/10 transition-transform hover:scale-110"
                    style={{
                      background: c,
                      outline: color === c ? "2px solid var(--foreground)" : "none",
                      outlineOffset: color === c ? 2 : 0,
                    }}
                  />
                ))}
              </div>
            </div>
            <div className="shrink-0 flex items-center justify-end gap-2 border-t border-border bg-popover px-3 py-2">
              <button
                type="button"
                onClick={closeReset}
                className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
              >
                Anuluj
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={!name.trim()}
                className="inline-flex h-7 items-center rounded-md bg-primary px-3 font-mono text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                Dodaj kolumnę
              </button>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
