"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
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
  Calendar,
  ChevronDown,
  ChevronRight,
  GitBranch,
  GripVertical,
  KanbanSquare,
  LayoutGrid,
  Pencil,
  Table2,
  Workflow,
} from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { ViewSwitcher } from "@/components/view/view-switcher";
import { reorderBoardsAction } from "@/app/(app)/w/[workspaceId]/b/actions";
import { type ViewName } from "@/lib/board-views";
import { taskPl } from "@/lib/pluralize";

// =============================================================================
// Drag-and-drop reorder tablic w workspace overview (design v4).
// Cały render board sections jest w client component żeby dnd-kit mógł
// zarządzać kolejnością. Layout 1:1 z Flovly v4 (Hero · Workspace Overview):
//   - liquid-glass karty: rgba(255,255,255,.6) bg + backdrop-blur, 1px border
//   - 3px top accent strip w kolorze workspace
//   - init badge 38px z kolorem workspace + brand-tinted shadow
//   - hover: translateY(-3px), spring easing cubic-bezier(.34,1.56,.64,1)
//   - view pills: rounded-lg 11px neutral; "+N" pill brand-tinted
// =============================================================================

const VIEW_META: Record<
  ViewName,
  { label: string; Icon: typeof Table2; accent: string }
> = {
  table: { label: "Tabela", Icon: Table2, accent: "text-primary/80" },
  kanban: { label: "Kanban", Icon: KanbanSquare, accent: "text-amber-500" },
  roadmap: { label: "Roadmapa", Icon: GitBranch, accent: "text-sky-500" },
  gantt: { label: "Gantt", Icon: BarChart3, accent: "text-rose-500" },
  calendar: { label: "Kalendarz", Icon: Calendar, accent: "text-indigo-500" },
  whiteboard: { label: "Whiteboard", Icon: Pencil, accent: "text-emerald-500" },
  taskline: { label: "Linia zadań", Icon: Workflow, accent: "text-fuchsia-500" },
};

// Paleta v4 hero (boards): violet · sky · emerald · amber · rose · sky-deep.
// Pierwsze 4 to bezpośrednio sample z HTML referencji, kolejne dorzucone żeby
// każda kolejna tablica miała własną tożsamość. Cyklujemy po id-hash żeby
// kolejność tablic nie wpływała na "który kolor dostała moja tablica".
const SWATCH_GRADIENTS: { color: string; shadow: string }[] = [
  { color: "#7A33EC", shadow: "rgba(122,51,236,.45)" }, // brand violet
  { color: "#34BEF8", shadow: "rgba(52,190,248,.40)" }, // sky accent
  { color: "#10B981", shadow: "rgba(16,185,129,.40)" }, // emerald
  { color: "#F59E0B", shadow: "rgba(245,158,11,.40)" }, // amber
  { color: "#E1318F", shadow: "rgba(225,49,143,.40)" }, // magenta brand-b
  { color: "#0EA5E9", shadow: "rgba(14,165,233,.40)" }, // info deep
];

// Stabilny hash dla deterministic color per board (nie randomizujemy żeby
// kolejne renderowania nie migały). FNV-1a 32-bit – wystarcza dla rozróżnienia.
function swatchFor(id: string): { color: string; shadow: string } {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  const idx = (h >>> 0) % SWATCH_GRADIENTS.length;
  return SWATCH_GRADIENTS[idx]!;
}

// 2-znakowe inicjały z nazwy tablicy (jak w v4 hero — "RA", "MQ", "OD", "BP").
// Bierzemy pierwsze litery pierwszych 2 słów, fallback na pierwsze 2 znaki.
function initialsFor(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0]![0]! + words[1]![0]!).toUpperCase();
  }
  const single = words[0] ?? "??";
  return single.slice(0, 2).toUpperCase();
}

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

// =============================================================================
// LIST variant — kompaktowa lista wierszy (workspace overview / list view).
// Mirror SortableWorkspaceRow: drag handle + Link z grid'em
// [name | view-pills | task count | arrow]. Mobile: vertical stack.
// =============================================================================

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
      <div className="overflow-hidden rounded-2xl border border-border bg-card/60 backdrop-blur-xl">
        <EmptyState
          icon={LayoutGrid}
          title="Brak tablic"
          description="Utwórz pierwszą tablicę żeby zacząć planować pracę zespołu."
        />
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={items.map((b) => b.id)} strategy={verticalListSortingStrategy}>
        <ul className="overflow-hidden rounded-2xl border border-border bg-card/60 backdrop-blur-xl">
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

// Wiersz listy — wzbogacony o color-coded init badge zgodny z v4 kafelkami,
// dzięki czemu lista i grid mają spójną tożsamość per workspace.
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
  // dostępna po kliknięciu w wiersz (Link → /b/[id]/table).
  const visibleViews = board.enabledViews.slice(0, 4);
  const moreCount = board.enabledViews.length - visibleViews.length;

  const swatch = useMemo(() => swatchFor(board.id), [board.id]);
  const initials = useMemo(() => initialsFor(board.name), [board.name]);

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
          className="group flex flex-1 items-center gap-3 px-3 py-3 transition-colors hover:bg-accent/60 focus-visible:bg-accent/60 focus-visible:outline-none md:grid md:grid-cols-[40px_minmax(0,1fr)_180px_70px_30px] md:gap-4 md:py-3.5"
        >
          {/* Init badge — workspace color identity, mirror grid card */}
          <span
            aria-hidden
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl font-display text-[0.72rem] font-bold text-white"
            style={{
              background: swatch.color,
              boxShadow: `0 6px 14px -5px ${swatch.shadow}`,
            }}
          >
            {initials}
          </span>

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
                    className={`inline-flex h-6 items-center gap-1 rounded-lg border border-border bg-background/70 px-1.5 font-mono text-[0.6rem] uppercase tracking-[0.12em] backdrop-blur-sm ${meta.accent}`}
                  >
                    <Icon size={10} />
                    <span className="max-md:hidden">{meta.label}</span>
                  </span>
                );
              })}
              {moreCount > 0 && (
                <span className="inline-flex h-6 items-center rounded-lg bg-primary/10 px-1.5 font-mono text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-primary">
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

// =============================================================================
// SECTION variant (legacy / rich preview) — pełna sekcja z rozwijanymi taskami
// + ViewSwitcher. Zostaje na wypadek gdyby ktoś chciał wrócić, nie jest
// publicznie exportowany ale zachowuje pełną funkcjonalność.
// =============================================================================

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
          localStorage.removeItem(COLLAPSE_KEY(workspaceId, board.id));
        } else {
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

// Suppress unused warning — komponent legacy, zachowujemy ale nie eksportujemy.
void SortableBoardSection;

// =============================================================================
// GRID variant (default) — kafelki v4 hero (3-col responsive). 1:1 z Flovly v4
// "Hero · Workspace Overview". Liquid-glass surfaces, color-coded badges,
// 3px top accent strip, spring hover translateY(-3px).
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
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
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

  const swatch = useMemo(() => swatchFor(board.id), [board.id]);
  const initials = useMemo(() => initialsFor(board.name), [board.name]);

  // Pierwsze 4 viewy widoczne w pełni (label + ikona). Reszta jako "+N" pill
  // w stylu brand-tinted (zgodnie z v4 HTML: rgba(122,51,236,.1) bg, #6A24DC).
  const visibleViews = board.enabledViews.slice(0, 4);
  const moreCount = board.enabledViews.length - visibleViews.length;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative ${isDragging ? "cursor-grabbing" : ""}`}
    >
      {/* Karta v4: liquid-glass z backdrop-blur, layered shadow, 3px top strip
          w kolorze workspace. p-5 (większe niż stare p-4), rounded-2xl (18px).
          Spring easing na hover [cubic-bezier(.34,1.56,.64,1)] żeby kafelki
          "skakały" z odbiciem — sygnatura v4 motion. */}
      <div
        className="relative flex h-full flex-col gap-3.5 overflow-hidden rounded-2xl border border-border/70 bg-card/70 p-5 pl-12 backdrop-blur-xl shadow-[0_1px_0_rgba(255,255,255,.6)_inset,0_14px_30px_-18px_rgba(76,29,149,.30)] transition-[transform,box-shadow,border-color] duration-300 [transition-timing-function:cubic-bezier(.34,1.56,.64,1)] group-hover:-translate-y-[3px] group-hover:border-primary/30 group-hover:shadow-[0_1px_0_rgba(255,255,255,.7)_inset,0_22px_44px_-18px_rgba(76,29,149,.45),0_30px_70px_-24px_rgba(225,49,143,.20)] max-md:min-h-[200px] md:h-[200px]"
      >
        {/* 3px top accent strip — wizualna "kotwica" koloru tablicy (v4 hero) */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[3px]"
          style={{ background: swatch.color }}
        />

        <Link
          href={`/w/${workspaceId}/b/${board.id}/table`}
          className="flex min-w-0 flex-col gap-2.5 focus-visible:outline-none"
        >
          {/* HEAD: init badge + nazwa/desc + task counter pill */}
          <div className="flex items-start gap-3">
            <span
              aria-hidden
              className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-xl font-display text-[0.82rem] font-bold text-white"
              style={{
                background: swatch.color,
                boxShadow: `0 6px 14px -5px ${swatch.shadow}`,
              }}
            >
              {initials}
            </span>
            <div className="min-w-0 flex-1">
              <span className="eyebrow">Tablica</span>
              <h2 className="mt-1 truncate font-display text-[1.05rem] font-bold leading-tight tracking-[-0.015em] text-foreground transition-colors group-hover:text-primary">
                {board.name}
              </h2>
              <p className="mt-0.5 truncate font-mono text-[0.66rem] uppercase tracking-[0.14em] text-muted-foreground">
                {board.taskCount} {taskPl(board.taskCount)}
              </p>
            </div>
            {/* Task counter — brand-tinted pill (v4: rgba(122,51,236,.08)) */}
            <span className="shrink-0 rounded-lg bg-primary/10 px-2 py-1 font-mono text-[0.66rem] font-semibold text-primary">
              {board.taskCount}
            </span>
          </div>
        </Link>

        {/* View pills — mt-auto żeby zawsze siadały na dole karty (równe kafelki).
            v4: rounded-lg, 11px medium, neutral bg z subtelnym border. */}
        <div className="-mx-1 mt-auto flex flex-wrap items-center gap-1.5 px-1 pb-0.5">
          {visibleViews.map((view) => {
            const meta = VIEW_META[view];
            const Icon = meta.Icon;
            return (
              <Link
                key={view}
                href={`/w/${workspaceId}/b/${board.id}/${view}`}
                title={meta.label}
                className={`inline-flex h-7 shrink-0 items-center gap-1 rounded-lg border border-border/60 bg-background/70 px-2 font-mono text-[0.62rem] font-medium uppercase tracking-[0.12em] backdrop-blur-sm transition-colors hover:border-primary/40 hover:bg-background ${meta.accent}`}
              >
                <Icon size={11} />
                <span>{meta.label}</span>
              </Link>
            );
          })}
          {moreCount > 0 && (
            <span className="inline-flex h-7 shrink-0 items-center rounded-lg bg-primary/10 px-2 font-mono text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-primary">
              +{moreCount}
            </span>
          )}
        </div>
      </div>

      {/* Drag handle po lewej krawędzi karty — wyciszony, ujawnia się na hover */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Przeciągnij tablicę"
        title="Przeciągnij aby zmienić kolejność"
        className="absolute left-3 top-[18px] grid h-8 w-8 cursor-grab place-items-center rounded-md text-muted-foreground/40 transition-colors hover:bg-accent hover:text-foreground active:cursor-grabbing"
      >
        <GripVertical size={16} />
      </button>
    </div>
  );
}
