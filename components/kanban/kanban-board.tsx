"use client";

import { startTransition, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { createTaskAction } from "@/app/(app)/w/[workspaceId]/t/actions";
import {
  createStatusColumnAction,
  reorderStatusColumnsAction,
} from "@/app/(app)/w/[workspaceId]/b/[boardId]/actions";
import { PRESET_COLORS } from "@/components/table/status-column-manager";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
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

export interface KanbanTask {
  id: string;
  title: string;
  statusColumnId: string | null;
  rowOrder: number;
  startAt: string | null;
  stopAt: string | null;
  assignees: {
    id: string;
    name: string | null;
    email: string;
    avatarUrl: string | null;
  }[];
  tags: { id: string; name: string; colorHex: string }[];
}

export interface KanbanStatusColumn {
  id: string;
  name: string;
  colorHex: string;
}

// Synthetic "No status" column id used locally; tasks without a status
// land here. On drop we persist statusColumnId = null.
const NO_STATUS = "__none__";

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

  // Resync local state when the server props change (revalidate).
  useEffect(() => {
    setTasks(initialTasks);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTasks.map((t) => `${t.id}:${t.statusColumnId ?? ""}:${t.rowOrder}`).join(",")]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

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
    setActiveId(String(event.active.id));
  };

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
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

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
    >
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-4 md:mx-0 md:gap-4 md:px-0">
        {renderColumns.map(({ id, column }, idx) => {
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
      <DragOverlay>
        {activeTask ? (
          <CardShell task={activeTask} workspaceId={workspaceId} dragging />
        ) : null}
      </DragOverlay>
      {assign.menu}
    </DndContext>
  );
}

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
  getHotkeyProps?: (task: KanbanTask) => {
    onMouseEnter: () => void;
    onMouseLeave: () => void;
  };
}) {
  const color = column?.colorHex ?? "#94A3B8";
  const name = column?.name ?? "Bez statusu";
  // Bez statusu column can't be added to — no statusColumnId for the server action.
  const canAddInline = id !== NO_STATUS;

  return (
    <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
      <div
        className="flex w-[280px] shrink-0 flex-col gap-2 rounded-xl border border-border bg-muted/40 p-3 md:w-[300px]"
      >
        <div className="flex items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-1">
            {canReorder && realColumnIds && realColumnIds.length > 1 && (
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={() => {
                    if (isFirstReal) return;
                    const fromIdx = realColumnIds.indexOf(id);
                    if (fromIdx <= 0) return;
                    const next = [...realColumnIds];
                    [next[fromIdx - 1], next[fromIdx]] = [next[fromIdx], next[fromIdx - 1]];
                    const fd = new FormData();
                    fd.set("workspaceId", workspaceId);
                    fd.set("boardId", boardId);
                    fd.set("ids", next.join(","));
                    startTransition(() => reorderStatusColumnsAction(fd));
                  }}
                  disabled={isFirstReal}
                  aria-label="W lewo"
                  title="Przesuń kolumnę w lewo"
                  className="grid h-5 w-5 place-items-center rounded-sm text-muted-foreground/70 transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
                >
                  <ChevronLeft size={11} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (isLastReal) return;
                    const fromIdx = realColumnIds.indexOf(id);
                    if (fromIdx < 0 || fromIdx >= realColumnIds.length - 1) return;
                    const next = [...realColumnIds];
                    [next[fromIdx], next[fromIdx + 1]] = [next[fromIdx + 1], next[fromIdx]];
                    const fd = new FormData();
                    fd.set("workspaceId", workspaceId);
                    fd.set("boardId", boardId);
                    fd.set("ids", next.join(","));
                    startTransition(() => reorderStatusColumnsAction(fd));
                  }}
                  disabled={isLastReal}
                  aria-label="W prawo"
                  title="Przesuń kolumnę w prawo"
                  className="grid h-5 w-5 place-items-center rounded-sm text-muted-foreground/70 transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
                >
                  <ChevronRight size={11} />
                </button>
              </div>
            )}
            <span
              className="inline-flex h-6 items-center rounded-full px-2 font-mono text-[0.62rem] font-semibold uppercase tracking-[0.12em]"
              style={{ color, background: `${color}22` }}
            >
              {name}
            </span>
          </div>
          <span className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground">
            {tasks.length}
          </span>
        </div>
        <ColumnDropZone id={id}>
          <div className="flex flex-col gap-2 min-h-[40px]">
            {tasks.map((t) => (
              <SortableCard
                key={t.id}
                task={t}
                workspaceId={workspaceId}
                hotkeyProps={getHotkeyProps?.(t)}
              />
            ))}
            {tasks.length === 0 && (
              <div className="rounded-lg border border-dashed border-border bg-background/40 py-6 text-center text-[0.72rem] uppercase tracking-[0.14em] text-muted-foreground/60">
                upuść tu
              </div>
            )}
          </div>
        </ColumnDropZone>
        {canAddInline && (
          <InlineAddTask
            workspaceId={workspaceId}
            boardId={boardId}
            statusColumnId={id}
          />
        )}
      </div>
    </SortableContext>
  );
}

function InlineAddTask({
  workspaceId,
  boardId,
  statusColumnId,
}: {
  workspaceId: string;
  boardId: string;
  statusColumnId: string;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
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
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="inline-flex h-7 items-center gap-1.5 rounded-md border border-dashed border-border bg-background/40 px-2 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
      >
        <Plus size={11} /> Nowe zadanie
      </button>
    );
  }
  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-primary/40 bg-background p-2">
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
          className="inline-flex h-6 items-center rounded-md bg-primary px-2.5 font-mono text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          Dodaj
        </button>
      </div>
    </div>
  );
}

function ColumnDropZone({ id, children }: { id: string; children: React.ReactNode }) {
  // Entire column is a drop target. Prefix "col:" so onDragOver/onDragEnd
  // can distinguish column hits from card-on-card hits.
  const { setNodeRef } = useDroppable({ id: `col:${id}` });
  return (
    <div ref={setNodeRef} className="flex-1">
      {children}
    </div>
  );
}

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
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      }}
      {...attributes}
      {...listeners}
    >
      <CardShell task={task} workspaceId={workspaceId} hotkeyProps={hotkeyProps} />
    </div>
  );
}

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
  return (
    <article
      {...(hotkeyProps ?? {})}
      className={`flex cursor-grab flex-col gap-2 rounded-lg border border-border bg-card p-3 shadow-[0_1px_2px_rgba(10,10,40,0.04)] transition-shadow hover:shadow-[0_6px_16px_-8px_rgba(123,104,238,0.35)] active:cursor-grabbing ${
        dragging ? "ring-2 ring-primary/50 shadow-[0_20px_32px_-12px_rgba(123,104,238,0.45)]" : ""
      }`}
    >
      {task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {task.tags.slice(0, 4).map((t) => (
            <span
              key={t.id}
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.64rem] font-medium"
              style={{ background: `${t.colorHex}1A`, color: t.colorHex }}
            >
              <span className="h-1 w-1 rounded-full" style={{ background: t.colorHex }} />
              {t.name}
            </span>
          ))}
        </div>
      )}
      <Link
        href={`/w/${workspaceId}/t/${task.id}`}
        onPointerDown={(e) => e.stopPropagation()}
        // break-words handles long URLs/IDs that would otherwise stretch the card past 300px.
        className="font-display text-[0.95rem] font-semibold leading-tight tracking-[-0.01em] whitespace-normal break-words transition-colors hover:text-primary"
      >
        {task.title}
      </Link>
      <div className="mt-auto flex items-center justify-between pt-1">
        {task.assignees.length > 0 ? (
          <div className="flex -space-x-1.5">
            {task.assignees.slice(0, 3).map((a) => (
              <span
                key={a.id}
                title={a.name ?? a.email}
                className="grid h-5 w-5 place-items-center overflow-hidden rounded-full border-2 border-card bg-brand-gradient font-display text-[0.56rem] font-bold text-white"
              >
                {a.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  (a.name ?? a.email).slice(0, 2).toUpperCase()
                )}
              </span>
            ))}
          </div>
        ) : (
          <span />
        )}
        {task.stopAt && (
          <span className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-muted-foreground">
            {new Date(task.stopAt).toLocaleDateString("pl-PL", { month: "short", day: "numeric" })}
          </span>
        )}
      </div>
    </article>
  );
}

// Mirrors AddColumnButton in board-table.tsx; creates a StatusColumn (not TableColumn).
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
      {/* self-start + fixed h-[52px] keeps trigger from stretching to column height. */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? closeReset() : openWithCoords())}
        aria-label="Dodaj kolumnę"
        className="inline-flex h-[52px] w-[280px] shrink-0 self-start items-center justify-center gap-1.5 rounded-xl border border-dashed border-border bg-muted/20 px-3 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted/40 hover:text-foreground md:w-[300px]"
      >
        <Plus size={13} /> Dodaj kolumnę
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
            className="z-[60] flex flex-col overflow-hidden rounded-xl border border-border bg-popover shadow-[0_18px_40px_-12px_rgba(10,10,40,0.3)]"
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
                className="mb-3 w-full rounded-md border border-border bg-background px-2 py-1.5 text-[0.86rem] outline-none focus:border-primary/60"
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
                className="inline-flex h-7 items-center rounded-md bg-primary px-3 font-mono text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
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

