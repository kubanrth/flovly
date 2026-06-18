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
import { ArrowRight, GripVertical } from "lucide-react";
import { reorderWorkspacesAction } from "@/app/(app)/workspaces/actions";
import { boardPl } from "@/lib/pluralize";

// Drag-and-drop reorder workspace'ów (zamiast strzałek).
// Pattern jak w kanban-board: DndContext + SortableContext + useSortable.
// Drag handle = ikona GripVertical po lewej, reszta karty klikalna do nawigacji.

export interface WorkspaceRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  role: string;
  boardCount: number;
}

export function SortableWorkspacesGrid({ rows }: { rows: WorkspaceRow[] }) {
  const [items, setItems] = useState(rows);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setItems((prev) => {
      const oldIdx = prev.findIndex((w) => w.id === active.id);
      const newIdx = prev.findIndex((w) => w.id === over.id);
      if (oldIdx < 0 || newIdx < 0) return prev;
      const next = arrayMove(prev, oldIdx, newIdx);
      // Optimistic UI — server save w tle
      const orderedIds = next.map((w) => w.id);
      startTransition(() => {
        void reorderWorkspacesAction(orderedIds);
      });
      return next;
    });
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={items.map((w) => w.id)} strategy={verticalListSortingStrategy}>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {items.map((w) => (
            <SortableWorkspaceCard key={w.id} workspace={w} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableWorkspaceCard({ workspace: w }: { workspace: WorkspaceRow }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: w.id });

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
      <Link
        href={`/w/${w.id}`}
        className="flex min-h-[180px] flex-col gap-4 rounded-xl border border-border bg-card p-6 pl-12 shadow-[0_1px_2px_rgba(46,19,52,0.08)] transition-all hover:-translate-y-[2px] hover:border-primary/30 hover:shadow-[0_12px_32px_-16px_rgba(123,104,238,0.35)] focus-visible:-translate-y-[2px] focus-visible:border-primary focus-visible:outline-none"
      >
        <div className="flex items-center justify-between">
          <span className="eyebrow">{w.role.toLowerCase()}</span>
          <span className="font-mono text-[0.68rem] text-muted-foreground">/{w.slug}</span>
        </div>
        <h2 className="font-display text-[1.5rem] font-bold leading-[1.15] tracking-[-0.02em] text-foreground">
          {w.name}
        </h2>
        {w.description && (
          <p className="line-clamp-2 text-[0.9rem] leading-[1.55] text-muted-foreground">
            {w.description}
          </p>
        )}
        <div className="mt-auto flex items-center justify-between pt-4">
          <span className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-muted-foreground">
            {w.boardCount} {boardPl(w.boardCount)}
          </span>
          <span className="inline-flex items-center gap-1 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors group-hover:text-primary">
            wejdź <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </Link>

      {/* Drag handle — przesunięty na lewą krawędź karty */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Przeciągnij aby zmienić kolejność"
        title="Przeciągnij aby zmienić kolejność"
        className="absolute left-3 top-1/2 grid h-8 w-8 -translate-y-1/2 cursor-grab place-items-center rounded-md text-muted-foreground/50 transition-colors hover:bg-accent hover:text-foreground active:cursor-grabbing"
      >
        <GripVertical size={16} />
      </button>
    </div>
  );
}

// List variant — drag-handle przed kontentem, reszta w jednej linii
export function SortableWorkspacesList({ rows }: { rows: WorkspaceRow[] }) {
  const [items, setItems] = useState(rows);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setItems((prev) => {
      const oldIdx = prev.findIndex((w) => w.id === active.id);
      const newIdx = prev.findIndex((w) => w.id === over.id);
      if (oldIdx < 0 || newIdx < 0) return prev;
      const next = arrayMove(prev, oldIdx, newIdx);
      const orderedIds = next.map((w) => w.id);
      startTransition(() => {
        void reorderWorkspacesAction(orderedIds);
      });
      return next;
    });
  };

  if (items.length === 0) {
    return (
      <ul className="overflow-hidden rounded-xl border border-border bg-card">
        <li className="px-5 py-6 text-center text-[0.9rem] text-muted-foreground">
          Brak przestrzeni — utwórz pierwszą poniżej.
        </li>
      </ul>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={items.map((w) => w.id)} strategy={verticalListSortingStrategy}>
        <ul className="overflow-hidden rounded-xl border border-border bg-card">
          {items.map((w) => (
            <SortableWorkspaceRow key={w.id} workspace={w} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function SortableWorkspaceRow({ workspace: w }: { workspace: WorkspaceRow }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: w.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    background: isDragging ? "var(--accent)" : undefined,
  } as const;

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="border-b border-border last:border-b-0"
    >
      <div className="flex items-center gap-1 pl-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label="Przeciągnij"
          title="Przeciągnij aby zmienić kolejność"
          className="grid h-8 w-8 shrink-0 cursor-grab place-items-center rounded-md text-muted-foreground/50 transition-colors hover:bg-accent hover:text-foreground active:cursor-grabbing"
        >
          <GripVertical size={14} />
        </button>
        {/* Mobile: vertical stack — desktop grid columns ściskały nazwę
            workspace'a do 2 znaków (klient: "Pr...", "Ki...", "E..."). Tytuł
            ma teraz pełną szerokość w pierwszym rzędzie, meta-info pod nim
            jako mono-pille. md+ wraca do gridu z 4 kolumnami. */}
        <Link
          href={`/w/${w.id}`}
          className="group flex flex-1 flex-col gap-2 px-3 py-3 transition-colors hover:bg-accent/60 focus-visible:bg-accent/60 focus-visible:outline-none md:grid md:grid-cols-[minmax(0,1fr)_90px_130px_30px] md:items-center md:gap-4 md:py-3.5"
        >
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate font-display text-[1.05rem] font-semibold leading-tight tracking-[-0.01em] transition-colors group-hover:text-primary">
              {w.name}
            </span>
            <span className="truncate font-mono text-[0.66rem] uppercase tracking-[0.14em] text-muted-foreground">
              /{w.slug}
              {w.description ? ` · ${w.description}` : ""}
            </span>
          </div>

          {/* Mobile: meta jako bottom row (pille zamiast kolumn). md+: trzy
              osobne kolumny grid'a. */}
          <div className="flex items-center gap-2 md:contents">
            <span className="inline-flex items-center rounded-full border border-border bg-card px-2 py-0.5 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-muted-foreground md:rounded-none md:border-0 md:bg-transparent md:px-0">
              {w.role.toLowerCase()}
            </span>
            <span className="inline-flex items-center rounded-full border border-border bg-card px-2 py-0.5 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-muted-foreground md:rounded-none md:border-0 md:bg-transparent md:px-0">
              {w.boardCount} {boardPl(w.boardCount)}
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
