"use client";

// Tablica (B4): kolumny 280px z drag&drop, tryb swimlane (B4-swimlane)
// i jednokolumnowy widok mobilny (B4-mobile). Dane i akcje bez zmian —
// przesunięcie karty leci przez patchTaskAction, kolumny przez akcje tablicy.

import { startTransition, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import {
  DndContext, DragOverlay, KeyboardSensor, MeasuringStrategy, MouseSensor, PointerSensor, TouchSensor,
  pointerWithin, rectIntersection, useSensor, useSensors,
  type CollisionDetection, type DragEndEvent, type DragOverEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { patchTaskAction } from "@/app/(app)/w/[workspaceId]/t/actions";
import { createStatusColumnAction } from "@/app/(app)/w/[workspaceId]/b/[boardId]/actions";
import { useWorkspaceRealtime } from "@/hooks/use-workspace-realtime";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { useAssignHotkey } from "@/components/task/assign-hotkey";
import { STATUS_PALETTE } from "@/lib/colors";
import { taskPl } from "@/lib/pluralize";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { IconPlus } from "@/components/ui/icons";
import {
  GROUP_LABEL, NO_STATUS, buildSwimlanes, columnBuckets, columnPl, filterTasks, lanePl, visibleColumnIds,
  type KanbanMember, type KanbanStatusColumn, type KanbanTask,
} from "@/components/kanban/kanban-model";
import { KanbanCard } from "@/components/kanban/kanban-card";
import { KanbanColumn } from "@/components/kanban/kanban-column";
import { KanbanMobile } from "@/components/kanban/kanban-mobile";
import { KanbanStateProvider, useKanbanState } from "@/components/kanban/kanban-state";

export type { KanbanStatusColumn, KanbanTask } from "@/components/kanban/kanban-model";

// Widok tablicy — stan (filtry, grupowanie, zwinięte kolumny) bierze z
// KanbanStateProvider, żeby toolbar w nagłówku tablicy patrzył na to samo.
export function KanbanBoardView({ initialTasks }: { initialTasks: KanbanTask[] }) {
  const s = useKanbanState();
  const isMobile = useIsMobile();
  const assign = useAssignHotkey({ members: s.members, workspaceId: s.workspaceId });
  const [tasks, setTasks] = useState<KanbanTask[]>(initialTasks);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dropHint, setDropHint] = useState<string | null>(null);
  const [, startPatch] = useTransition();
  useWorkspaceRealtime(s.workspaceId);

  // Resync on revalidate, but never mid-drag — a broadcast from another user
  // would yank the card back from under the cursor.
  const draggingRef = useRef(false);
  useEffect(() => {
    if (draggingRef.current) return;
    setTasks(initialTasks);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTasks.map((t) => `${t.id}:${t.statusColumnId ?? ""}:${t.rowOrder}`).join(",")]);

  const visible = useMemo(
    () => filterTasks(tasks, { query: s.search, people: s.people, priority: s.priority }),
    [tasks, s.search, s.people, s.priority],
  );
  const buckets = useMemo(() => columnBuckets(visible, s.statusColumns, s.sort), [visible, s.statusColumns, s.sort]);
  const columnIds = useMemo(() => visibleColumnIds(s.statusColumns, buckets), [s.statusColumns, buckets]);
  const columnById = useMemo(() => new Map(s.statusColumns.map((c) => [c.id, c])), [s.statusColumns]);
  const activeTask = activeId ? tasks.find((t) => t.id === activeId) ?? null : null;
  const hoverProps = (t: KanbanTask) => assign.rowProps(t.id, t.assignees.map((a) => a.id));

  const sensors = useSensors(
    // Mouse reacts after 4px; touch waits 180ms so a swipe still scrolls.
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  // pointerWithin is precise inside a column; rectIntersection covers the gaps.
  const collisionDetection: CollisionDetection = (args) => {
    const pointer = pointerWithin(args);
    return pointer.length > 0 ? pointer : rectIntersection(args);
  };

  const columnOf = (taskId: string) => tasks.find((t) => t.id === taskId)?.statusColumnId ?? NO_STATUS;
  const columnOfOver = (overId: string): string | null => {
    if (overId.startsWith("col:")) return overId.slice(4);
    const overTask = tasks.find((t) => t.id === overId);
    return overTask ? overTask.statusColumnId ?? NO_STATUS : null;
  };

  const onDragStart = (e: DragStartEvent) => {
    draggingRef.current = true;
    setActiveId(String(e.active.id));
  };

  // Preview the move immediately; persistence happens on drag end.
  const onDragOver = (e: DragOverEvent) => {
    if (!e.over) return;
    const activeTaskId = String(e.active.id);
    const overCol = columnOfOver(String(e.over.id));
    if (!overCol) return;
    setDropHint(overCol);
    if (overCol === columnOf(activeTaskId)) return;
    setTasks((prev) =>
      prev.map((t) => (t.id === activeTaskId ? { ...t, statusColumnId: overCol === NO_STATUS ? null : overCol } : t)),
    );
  };

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    setActiveId(null);
    setDropHint(null);
    draggingRef.current = false;
    if (!over) return;
    const id = String(active.id);
    const overId = String(over.id);
    const task = tasks.find((t) => t.id === id);
    if (!task) return;

    const targetColId = columnOfOver(overId);
    if (!targetColId) return;
    const colTasks = buckets.get(targetColId) ?? [];
    const targetIndex = overId.startsWith("col:")
      ? colTasks.length
      : (() => {
          const cur = colTasks.findIndex((t) => t.id === id);
          const over = colTasks.findIndex((t) => t.id === overId);
          return cur === -1 ? over + 1 : over;
        })();

    const rest = colTasks.filter((t) => t.id !== id);
    const before = targetIndex > 0 ? rest[targetIndex - 1] : null;
    const after = targetIndex < rest.length ? rest[targetIndex] : null;
    const rowOrder =
      before && after ? (before.rowOrder + after.rowOrder) / 2
      : before ? before.rowOrder + 1
      : after ? after.rowOrder / 2
      : 1;
    const statusColumnId = targetColId === NO_STATUS ? null : targetColId;
    if (task.statusColumnId === statusColumnId && task.rowOrder === rowOrder) return;

    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, statusColumnId, rowOrder } : t)));
    const fd = new FormData();
    fd.set("id", id);
    fd.set("statusColumnId", statusColumnId ?? "");
    fd.set("rowOrder", String(rowOrder));
    startPatch(() => { patchTaskAction(fd); });
  };

  const footer = (left: string, right?: string) => (
    <div data-ui="kanban-footer" className="flex h-8 shrink-0 items-center border-t border-border bg-canvas px-6 font-mono text-2xs text-fg-2 max-md:px-4">
      <span>{left}</span>
      {right && <span className="ml-auto truncate pl-4 text-fg-3">{right}</span>}
    </div>
  );

  if (isMobile) {
    return (
      <div data-ui="kanban-view" className="-mx-4 -my-4 flex min-h-0 flex-1 flex-col">
        <KanbanMobile buckets={buckets} columnIds={columnIds} columnById={columnById} />
        {assign.menu}
      </div>
    );
  }

  if (s.groupBy !== "status") {
    const lanes = buildSwimlanes(visible, columnIds, s.groupBy, s.members, s.sort);
    return (
      <div data-ui="kanban-view" className="-mx-6 -my-4 flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-auto bg-canvas px-6 py-3">
          <div className="flex gap-3 pb-1.5 pl-[176px]">
            {columnIds.map((id) => (
              <span key={id} className="eyebrow w-[300px] shrink-0 truncate text-fg-2">
                {columnById.get(id)?.name ?? "Bez statusu"}
              </span>
            ))}
          </div>
          {lanes.length === 0 && <p className="border-t border-border py-10 text-center text-sm text-muted-foreground">Brak zadań</p>}
          {lanes.map((lane) => (
            <div key={lane.key} data-ui="kanban-swimlane" className="flex gap-3 border-t border-border py-2.5">
              <div className="flex w-[164px] shrink-0 items-start gap-2 pt-0.5">
                {lane.avatar && <Avatar name={lane.avatar.name} src={lane.avatar.src} size={24} />}
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold leading-[17px]">{lane.label}</span>
                  <span className="block font-mono text-[10px] text-fg-3">{lane.count} {taskPl(lane.count)}</span>
                </span>
              </div>
              {columnIds.map((id) => (
                <div key={id} className="flex w-[300px] shrink-0 flex-col gap-2">
                  {lane.cells[id]?.map((t) => (
                    <KanbanCard key={t.id} task={t} workspaceId={s.workspaceId} hoverProps={hoverProps(t)} className="cursor-default active:cursor-default" />
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
        {footer(`Swimlane: ${GROUP_LABEL[s.groupBy]} · ${lanes.length} ${lanePl(lanes.length)}`)}
        {assign.menu}
      </div>
    );
  }

  return (
    <DndContext
      id="kanban"
      sensors={sensors}
      collisionDetection={collisionDetection}
      // Re-measure on every layout change, otherwise columns that grew during
      // the drag keep their stale rects and the cursor snaps past them.
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      accessibility={{
        announcements: {
          onDragStart: ({ active }) => `Podniesiono zadanie ${active.id}`,
          onDragOver: ({ active, over }) => (over ? `Zadanie ${active.id} nad ${over.id}` : undefined),
          onDragEnd: ({ active, over }) => (over ? `Upuszczono zadanie ${active.id} na ${over.id}` : `Anulowano przeniesienie zadania ${active.id}`),
          onDragCancel: ({ active }) => `Anulowano przeniesienie zadania ${active.id}`,
        },
        screenReaderInstructions: {
          draggable: "Naciśnij Space lub Enter aby podnieść. Strzałki aby przenieść. Space aby upuścić. Esc aby anulować.",
        },
      }}
    >
      <div data-ui="kanban-view" className="-mx-6 -my-4 flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-auto bg-canvas px-6 py-4">
          <div className="flex items-start gap-3">
            {columnIds.map((id) => (
              <KanbanColumn key={id} id={id} column={columnById.get(id) ?? null} tasks={buckets.get(id) ?? []} hoverProps={hoverProps} />
            ))}
            {s.canManageBoard && <AddColumnButton />}
          </div>
        </div>
        {footer(
          `${visible.length} ${taskPl(visible.length)} · ${columnIds.length} ${columnPl(columnIds.length)}`,
          activeTask ? `przeciąganie: karta #${activeTask.displayId} → ${dropHint ? columnById.get(dropHint)?.name ?? "Bez statusu" : "—"}` : undefined,
        )}
      </div>
      {typeof document !== "undefined" &&
        createPortal(
          // Portal pod <body>: DragOverlay jest position:fixed, więc każdy
          // transform w przodkach przesunąłby kartę względem kursora.
          <DragOverlay>{activeTask ? <KanbanCard task={activeTask} workspaceId={s.workspaceId} dragging className="w-[280px]" /> : null}</DragOverlay>,
          document.body,
        )}
      {assign.menu}
    </DndContext>
  );
}

function AddColumnButton() {
  const s = useKanbanState();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(STATUS_PALETTE[0]!);

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const fd = new FormData();
    fd.set("workspaceId", s.workspaceId);
    fd.set("boardId", s.boardId);
    fd.set("name", trimmed);
    fd.set("colorHex", color);
    startTransition(async () => {
      await createStatusColumnAction(fd);
      setName("");
      setOpen(false);
    });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label="Dodaj kolumnę"
        className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2 text-sm text-fg-2 outline-none hover:bg-n-100 hover:text-foreground active:bg-n-200 data-popup-open:bg-n-100"
      >
        <IconPlus width={13} height={13} />
        Kolumna
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[260px] p-3">
        <p className="eyebrow mb-1.5">Nowa kolumna</p>
        <Input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
          maxLength={40}
          placeholder="np. Wstrzymane"
          aria-label="Nazwa kolumny"
        />
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {STATUS_PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Kolor ${c}`}
              aria-pressed={color === c}
              onClick={() => setColor(c)}
              style={{ background: c }}
              className={cn(
                "size-6 rounded-full outline-none hover:shadow-[0_0_0_2px_var(--n-300)] active:shadow-[0_0_0_2px_var(--n-400)]",
                color === c && "shadow-[0_0_0_2px_var(--control-on)]",
              )}
            />
          ))}
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Anuluj</Button>
          <Button size="sm" disabled={!name.trim()} onClick={submit}>Dodaj</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Wejście dla stron, które nie stawiają własnego providera (widoki custom
// `/b/[boardId]/v/[viewId]`) — te same propsy co przed redesignem.
export function KanbanBoard({
  workspaceId,
  boardId,
  viewId,
  statusColumns,
  members,
  canManageBoard,
  initialTasks,
}: {
  workspaceId: string;
  boardId: string;
  viewId?: string;
  statusColumns: KanbanStatusColumn[];
  members: KanbanMember[];
  canManageBoard: boolean;
  // displayId nieobowiązkowe — starsze wywołania go nie przekazują (karta ukrywa wtedy #ID).
  initialTasks: (Omit<KanbanTask, "displayId"> & { displayId?: number })[];
}) {
  return (
    <KanbanStateProvider
      meta={{ workspaceId, boardId, viewId, canEdit: true, canCreate: true, canManageBoard, statusColumns, members }}
    >
      <KanbanBoardView initialTasks={initialTasks.map((t) => ({ ...t, displayId: t.displayId ?? 0 }))} />
    </KanbanStateProvider>
  );
}
