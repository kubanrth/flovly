"use client";

import { startTransition, useEffect, useState } from "react";
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
  ArrowRight,
  BarChart3,
  ChevronDown,
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

// Drag-and-drop reorder tablic w workspace overview.
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

// Klient: "zamienmy w momencie jak wchodzisz w dana przestrzen i wybierasz
// widok lista to zrob taki sam widok jak wchodzisz we wszystkie przestrzenie
// i dajesz widok lista". Stary SortableBoardsList renderował SortableBoard-
// Section z rich task-preview'em (rozwijane sekcje z status badges, dates,
// assignees). Klient woli prostszy row-based list jak na /workspaces.
//
// Nowy layout = 1:1 SortableWorkspacesList:
//   - <ul> z overflow-hidden rounded-xl border bg-card
//   - per row: drag handle + Link z grid'em [name minmax(0,1fr) | view-pills 130px | tasks 70px | arrow 30px]
//   - mobile: vertical stack (md+ wraca do grid)
//
// Stary SortableBoardSection przemianowany na SortableBoardSectionLegacy —
// zostaje na wypadek gdyby ktoś chciał wrócić, ale nie jest exportowany.
export function SortableBoardsList({
  workspaceId,
  boards,
}: {
  workspaceId: string;
  boards: BoardSectionData[];
}) {
  const [items, setItems] = useState(boards);
  useEffect(() => {
    setItems(boards);
  }, [boards]);
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

  if (items.length === 0) {
    return (
      <ul className="overflow-hidden rounded-xl border border-border bg-card">
        <li className="px-5 py-6 text-center text-[0.9rem] text-muted-foreground">
          Brak tablic — utwórz pierwszą.
        </li>
      </ul>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={items.map((b) => b.id)} strategy={verticalListSortingStrategy}>
        <ul className="overflow-hidden rounded-xl border border-border bg-card">
          {items.map((board) => (
            <SortableBoardRow
              key={board.id}
              workspaceId={workspaceId}
              board={board}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

// Row mirror SortableWorkspaceRow — grid 4-col na desktop, vertical stack
// mobile. View pills w środkowej kolumnie zamiast "rola"/"slug" usera.
function SortableBoardRow({
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
    opacity: isDragging ? 0.5 : 1,
    background: isDragging ? "var(--accent)" : undefined,
  } as const;

  // Top 4 view'ów żeby nie ciągnąć całej listy w wąskiej kolumnie. Reszta
  // dostępna po kliknięciu w wiersz (Link → /b/[id]/table). 4 jest blisko
  // pełnej listy (max 5: Tabela/Kanban/Roadmapa/Gantt/Whiteboard).
  const visibleViews = board.enabledViews.slice(0, 4);
  const moreCount = board.enabledViews.length - visibleViews.length;

  return (
    <li ref={setNodeRef} style={style} className="border-b border-border last:border-b-0">
      <div className="flex items-center gap-1 pl-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label="Przeciągnij tablicę"
          title="Przeciągnij aby zmienić kolejność"
          className="grid h-8 w-8 shrink-0 cursor-grab place-items-center rounded-md text-muted-foreground/50 transition-colors hover:bg-accent hover:text-foreground active:cursor-grabbing"
        >
          <GripVertical size={14} />
        </button>
        <Link
          href={`/w/${workspaceId}/b/${board.id}/table`}
          className="group flex flex-1 flex-col gap-2 px-3 py-3 transition-colors hover:bg-accent/60 focus-visible:bg-accent/60 focus-visible:outline-none md:grid md:grid-cols-[minmax(0,1fr)_180px_70px_30px] md:items-center md:gap-4 md:py-3.5"
        >
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate font-display text-[1.05rem] font-semibold leading-tight tracking-[-0.01em] transition-colors group-hover:text-primary">
              {board.name}
            </span>
            <span className="truncate font-mono text-[0.66rem] uppercase tracking-[0.14em] text-muted-foreground">
              Tablica · {board.taskCount} {taskPl(board.taskCount)}
            </span>
          </div>

          {/* Meta: view pills + task count + arrow. Mobile: bottom row pills. */}
          <div className="flex items-center gap-2 md:contents">
            <div className="flex flex-wrap items-center gap-1">
              {visibleViews.map((view) => {
                const meta = VIEW_META[view];
                const Icon = meta.Icon;
                return (
                  <span
                    key={view}
                    title={meta.label}
                    className={`inline-flex h-6 items-center gap-1 rounded-md border border-border bg-background px-1.5 font-mono text-[0.6rem] uppercase tracking-[0.12em] ${meta.accent}`}
                  >
                    <Icon size={10} />
                    <span className="max-md:hidden">{meta.label}</span>
                  </span>
                );
              })}
              {moreCount > 0 && (
                <span className="inline-flex h-6 items-center rounded-md border border-border bg-background px-1.5 font-mono text-[0.6rem] uppercase tracking-[0.12em] text-muted-foreground">
                  +{moreCount}
                </span>
              )}
            </div>
            <span className="inline-flex items-center rounded-full border border-border bg-card px-2 py-0.5 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-muted-foreground md:rounded-none md:border-0 md:bg-transparent md:px-0">
              {board.taskCount} {taskPl(board.taskCount)}
            </span>
            <ArrowRight
              size={14}
              className="ml-auto text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary md:ml-0 md:justify-self-end"
            />
          </div>
        </Link>
      </div>
    </li>
  );
}

// localStorage key — scoped per (workspace, board) so collapse state survives
// nav between workspaces without bleeding across them.
const COLLAPSE_KEY = (workspaceId: string, boardId: string) =>
  `flovly:board-collapsed:${workspaceId}:${boardId}`;

function SortableBoardSection({
  workspaceId,
  board,
}: {
  workspaceId: string;
  board: BoardSectionData;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: board.id });

  // Default is COLLAPSED so workspaces with many boards open scannable. User
  // explicitly expanding writes "0" to localStorage — semantics inverted from
  // the original "1 = collapsed" so the no-data path lands on the new default.
  // Hydration-safe: SSR renders collapsed; effect lifts to expanded if the
  // user previously chose that for this board.
  const [collapsed, setCollapsed] = useState(true);
  useEffect(() => {
    try {
      const stored = localStorage.getItem(COLLAPSE_KEY(workspaceId, board.id));
      if (stored === "0") setCollapsed(false);
    } catch {
      /* storage disabled — stay with default */
    }
  }, [workspaceId, board.id]);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        if (next) {
          // Collapsed = default; remove the explicit-expanded marker.
          localStorage.removeItem(COLLAPSE_KEY(workspaceId, board.id));
        } else {
          // Explicit expand — persist so it survives revisits.
          localStorage.setItem(COLLAPSE_KEY(workspaceId, board.id), "0");
        }
      } catch {
        /* storage disabled */
      }
      return next;
    });
  };

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
          {/* Collapse toggle — keeps the workspace overview scannable when a
              workspace has many boards with long task lists. */}
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Rozwiń tablicę" : "Zwiń tablicę"}
            title={collapsed ? "Rozwiń tablicę" : "Zwiń tablicę"}
            className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
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
      {!collapsed && (
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
      )}

      {/* Tasks preview */}
      {!collapsed && (board.tasks.length === 0 ? (
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
                  <span className="truncate pr-0.5 font-display text-[0.98rem] font-semibold leading-tight tracking-[-0.01em] transition-colors group-hover:text-primary">
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
      ))}
    </section>
  );
}

// =============================================================================
// GRID variant — kafelki jak na /workspaces (3-col responsive). Klient:
// "Potrzebujemy zrobić to w formie kafelek, jak w przypadku widoku wszystkich
// workspace". List variant zostaje jako opcja w BoardsLayoutToggle.
// =============================================================================

export function SortableBoardsGrid({
  workspaceId,
  boards,
}: {
  workspaceId: string;
  boards: BoardSectionData[];
}) {
  const [items, setItems] = useState(boards);
  useEffect(() => {
    setItems(boards);
  }, [boards]);
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
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {items.map((board) => (
            <SortableBoardCard key={board.id} workspaceId={workspaceId} board={board} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableBoardCard({
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
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : "auto",
  } as const;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative ${isDragging ? "cursor-grabbing" : ""}`}
    >
      {/* Klient: "zostawmy tylko informacje o tym jakie są widoki, ale niech
          się mieszczą w jednej linii. Bez zadań, żeby przestrzenie wyglądały
          na równe". Fixed h-[180px] zamiast min-h żeby kafelki MIAŁY tę samą
          wysokość niezależnie od liczby widoków. flex-nowrap + overflow-x-auto
          na pillach żeby przy 5 włączonych widokach (Tabela/Kanban/Roadmapa/
          Gantt/Whiteboard) nie złamało się na drugą linię. */}
      {/* Desktop: h-[180px] żeby wszystkie kafelki w grid'zie były równe.
          Mobile: min-h żeby wrap'nięte pills (Roadmapa/Whiteboard) mogły
          przelać się na drugą linię bez ucinania. */}
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5 pl-12 shadow-[0_1px_2px_rgba(10,10,40,0.04)] transition-all group-hover:-translate-y-[2px] group-hover:border-primary/30 group-hover:shadow-[0_12px_32px_-16px_rgba(123,104,238,0.35)] max-md:min-h-[180px] md:h-[180px]">
        <Link
          href={`/w/${workspaceId}/b/${board.id}/table`}
          className="flex min-w-0 flex-col gap-2 focus-visible:outline-none"
        >
          <span className="eyebrow">Tablica</span>
          <h2 className="truncate font-display text-[1.25rem] font-bold leading-[1.15] tracking-[-0.02em] text-foreground transition-colors group-hover:text-primary">
            {board.name}
          </h2>
          <span className="font-mono text-[0.66rem] uppercase tracking-[0.14em] text-muted-foreground">
            {board.taskCount} {taskPl(board.taskCount)}
          </span>
        </Link>

        {/* View pills — szybkie wejście z kafelka do konkretnego widoku.
            Mobile (max-md): flex-wrap żeby Roadmapa/Whiteboard nie były ucięte
            poza prawą krawędzią (klient: "Roadmapa ucięta"). md+: flex-nowrap
            + overflow-x-auto żeby pojedyncza linia w gridzie 3-col. */}
        <div className="-mx-1 mt-auto flex items-center gap-1.5 px-1 pb-1 max-md:flex-wrap md:flex-nowrap md:overflow-x-auto">
          {board.enabledViews.map((view) => {
            const meta = VIEW_META[view];
            const Icon = meta.Icon;
            return (
              <Link
                key={view}
                href={`/w/${workspaceId}/b/${board.id}/${view}`}
                title={meta.label}
                className={`inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-border bg-background px-2 font-mono text-[0.62rem] uppercase tracking-[0.12em] transition-colors hover:border-primary/40 hover:text-foreground ${meta.accent}`}
              >
                <Icon size={11} />
                <span>{meta.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Drag handle po lewej krawędzi karty */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Przeciągnij tablicę"
        title="Przeciągnij aby zmienić kolejność"
        className="absolute left-3 top-1/2 grid h-8 w-8 -translate-y-1/2 cursor-grab place-items-center rounded-md text-muted-foreground/50 transition-colors hover:bg-accent hover:text-foreground active:cursor-grabbing"
      >
        <GripVertical size={16} />
      </button>
    </div>
  );
}
