"use client";

import { startTransition, useState } from "react";
import Link from "next/link";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
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
  BarChart3,
  ChevronRight,
  GitBranch,
  GripVertical,
  KanbanSquare,
  Pencil,
  Table2,
} from "lucide-react";
import { ViewSwitcher } from "@/components/view/view-switcher";
import { reorderBoardsAction } from "@/app/(app)/w/[workspaceId]/b/actions";
import { type ViewName } from "@/lib/board-views";
import { taskPl } from "@/lib/pluralize";

// F12-K52: drag-and-drop reorder tablic w workspace overview.
// Cały render board sections jest w client component żeby dnd-kit mógł
// zarządzać kolejnością.

const VIEW_META: Record<
  ViewName,
  { label: string; Icon: typeof Table2; accent: string }
> = {
  table: { label: "Tabela", Icon: Table2, accent: "text-primary/80" },
  kanban: { label: "Kanban", Icon: KanbanSquare, accent: "text-amber-500" },
  roadmap: { label: "Roadmapa", Icon: GitBranch, accent: "text-sky-500" },
  gantt: { label: "Gantt", Icon: BarChart3, accent: "text-rose-500" },
  whiteboard: { label: "Whiteboard", Icon: Pencil, accent: "text-emerald-500" },
};

export interface BoardSectionData {
  id: string;
  name: string;
  taskCount: number;
  enabledViews: ViewName[];
  tasks: BoardTask[];
}

export interface BoardTask {
  id: string;
  title: string;
  stopAt: string | null;
  statusName: string | null;
  statusColor: string | null;
  assignees: { userId: string; name: string | null; email: string; avatarUrl: string | null }[];
  tags: { id: string; name: string; colorHex: string }[];
}

export function SortableBoardsList({
  workspaceId,
  boards,
}: {
  workspaceId: string;
  boards: BoardSectionData[];
}) {
  const [items, setItems] = useState(boards);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setItems((prev) => {
      const oldIdx = prev.findIndex((b) => b.id === active.id);
      const newIdx = prev.findIndex((b) => b.id === over.id);
      if (oldIdx < 0 || newIdx < 0) return prev;
      const next = arrayMove(prev, oldIdx, newIdx);
      const orderedIds = next.map((b) => b.id);
      startTransition(() => {
        void reorderBoardsAction(workspaceId, orderedIds);
      });
      return next;
    });
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={items.map((b) => b.id)} strategy={verticalListSortingStrategy}>
        {items.map((board) => (
          <SortableBoardSection key={board.id} workspaceId={workspaceId} board={board} />
        ))}
      </SortableContext>
    </DndContext>
  );
}

function SortableBoardSection({
  workspaceId,
  board,
}: {
  workspaceId: string;
  board: BoardSectionData;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: board.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 10 : "auto",
  } as const;

  return (
    <section
      ref={setNodeRef}
      style={style}
      className="flex flex-col gap-4 md:gap-5"
    >
      <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          {/* Drag handle */}
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label="Przeciągnij tablicę"
            title="Przeciągnij aby zmienić kolejność"
            className="grid h-8 w-8 cursor-grab place-items-center rounded-md text-muted-foreground/50 transition-colors hover:bg-accent hover:text-foreground active:cursor-grabbing"
          >
            <GripVertical size={16} />
          </button>
          <h2 className="font-display text-[1.2rem] font-bold leading-[1.15] tracking-[-0.02em] md:text-[1.5rem]">
            <Link
              href={`/w/${workspaceId}/b/${board.id}/table`}
              className="transition-colors hover:text-primary"
            >
              {board.name}
            </Link>
            <span className="ml-3 font-mono text-[0.7rem] font-normal uppercase tracking-[0.14em] text-muted-foreground">
              {board.taskCount} {taskPl(board.taskCount)}
            </span>
          </h2>
        </div>
        <div className="max-md:hidden">
          <ViewSwitcher workspaceId={workspaceId} boardId={board.id} enabled={board.enabledViews} />
        </div>
      </div>

      {/* Mobile-only view list */}
      <ul className="md:hidden flex flex-col overflow-hidden rounded-xl border border-border bg-card">
        {board.enabledViews.map((view) => {
          const meta = VIEW_META[view];
          const Icon = meta.Icon;
          return (
            <li key={view} className="border-b border-border last:border-b-0">
              <Link
                href={`/w/${workspaceId}/b/${board.id}/${view}`}
                className="group flex items-center gap-3 px-4 py-3 transition-colors active:bg-accent/40"
              >
                <span
                  className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-muted/50 ${meta.accent}`}
                  aria-hidden
                >
                  <Icon size={16} />
                </span>
                <span className="flex-1 font-display text-[0.98rem] font-semibold tracking-[-0.01em]">
                  {meta.label}
                </span>
                <ChevronRight size={16} className="shrink-0 text-muted-foreground" />
              </Link>
            </li>
          );
        })}
      </ul>

      {/* Tasks preview */}
      {board.tasks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-center text-muted-foreground md:p-8">
          <p className="font-display text-[1rem] font-semibold md:text-[1.05rem]">Brak zadań.</p>
          <p className="mt-1 font-mono text-[0.7rem] uppercase tracking-[0.14em]">
            zacznij od przycisku „Nowe zadanie” powyżej
          </p>
        </div>
      ) : (
        <ul className="flex flex-col overflow-hidden rounded-xl border border-border bg-card">
          {board.tasks.map((task) => (
            <li key={task.id} className="border-b border-border last:border-b-0">
              <Link
                href={`/w/${workspaceId}/t/${task.id}`}
                className="group flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-accent/60 focus-visible:bg-accent/60 focus-visible:outline-none"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    {task.statusName && task.statusColor && (
                      <span
                        className="inline-flex h-5 items-center rounded-full px-2 font-mono text-[0.6rem] font-semibold uppercase tracking-[0.12em]"
                        style={{
                          color: task.statusColor,
                          background: `${task.statusColor}22`,
                        }}
                      >
                        {task.statusName}
                      </span>
                    )}
                    {task.tags.map((tag) => (
                      <span
                        key={tag.id}
                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.7rem] font-medium"
                        style={{ background: `${tag.colorHex}1A`, color: tag.colorHex }}
                      >
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ background: tag.colorHex }}
                        />
                        {tag.name}
                      </span>
                    ))}
                  </div>
                  <span className="truncate font-display text-[0.98rem] font-semibold leading-tight tracking-[-0.01em] transition-colors group-hover:text-primary">
                    {task.title}
                  </span>
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  {task.assignees.length > 0 && (
                    <div className="flex -space-x-1.5">
                      {task.assignees.slice(0, 3).map((a) => (
                        <span
                          key={a.userId}
                          className="grid h-6 w-6 place-items-center overflow-hidden rounded-full border-2 border-background bg-brand-gradient font-display text-[0.6rem] font-bold text-white"
                          title={a.name ?? a.email}
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
                  )}
                  {task.stopAt && (
                    <span className="font-mono text-[0.7rem] uppercase tracking-[0.12em] text-muted-foreground">
                      do {new Date(task.stopAt).toLocaleDateString("pl-PL")}
                    </span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
