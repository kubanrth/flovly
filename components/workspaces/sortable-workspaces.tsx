"use client";

import { startTransition, useMemo, useState } from "react";
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
import { ArrowRight, ChevronRight, GripVertical } from "lucide-react";
import { reorderWorkspacesAction } from "@/app/(app)/workspaces/actions";
import { boardPl } from "@/lib/pluralize";

// =============================================================================
// Mobile v4 spec (B2 · Workspaces): każdy workspace ma color identity —
// 38x38 init badge + 3px top accent strip. Kolor wybrany deterministycznie
// z hash'a workspace.id (FNV-1a 32-bit), żeby nie migało między renderami.
// Lista swatchy z v4 hero (boards) — spójna paleta przez całą apkę.
// =============================================================================

const WORKSPACE_SWATCHES: { color: string; shadow: string }[] = [
  { color: "#7A33EC", shadow: "rgba(122,51,236,.45)" }, // brand violet
  { color: "#34BEF8", shadow: "rgba(52,190,248,.40)" }, // sky accent
  { color: "#10B981", shadow: "rgba(16,185,129,.40)" }, // emerald
  { color: "#F59E0B", shadow: "rgba(245,158,11,.40)" }, // amber
  { color: "#E1318F", shadow: "rgba(225,49,143,.40)" }, // magenta brand-b
  { color: "#0EA5E9", shadow: "rgba(14,165,233,.40)" }, // info deep
];

function swatchFor(id: string): { color: string; shadow: string } {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  const idx = (h >>> 0) % WORKSPACE_SWATCHES.length;
  return WORKSPACE_SWATCHES[idx]!;
}

function initialsFor(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0]![0]! + words[1]![0]!).toUpperCase();
  }
  const single = words[0] ?? "??";
  return single.slice(0, 2).toUpperCase();
}

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

  // Mobile v4 spec B2: każda karta dostaje workspace color identity (init badge
  // 38x38 + 3px accent strip). Hash stabilny per id — kolor nie zmienia się
  // między renderami i reorderami.
  const swatch = useMemo(() => swatchFor(w.id), [w.id]);
  const initials = useMemo(() => initialsFor(w.name), [w.name]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative ${isDragging ? "cursor-grabbing" : ""}`}
    >
      <Link
        href={`/w/${w.id}`}
        // Mobile v4: full-width card z accent strip + init badge; klikalna całość.
        // Desktop: oryginalny layout z pl-12 (miejsce pod drag handle).
        className="relative flex min-h-[120px] flex-col gap-3 overflow-hidden rounded-xl border border-border bg-card p-5 shadow-[0_1px_2px_rgba(46,19,52,0.08)] transition-all hover:-translate-y-[2px] hover:border-primary/30 hover:shadow-[0_12px_32px_-16px_rgba(123,104,238,0.35)] focus-visible:-translate-y-[2px] focus-visible:border-primary focus-visible:outline-none md:min-h-[180px] md:gap-4 md:p-6 md:pl-12"
      >
        {/* 3px top accent strip — mobile-only sygnatura workspace color identity */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[3px] md:hidden"
          style={{ background: swatch.color }}
        />

        {/* Mobile row: init badge 38x38 + name + meta + chevron. Desktop: ten row
            jest ukryty, layout idzie do oryginalnego pionowego stosu poniżej. */}
        <div className="flex items-center gap-3 md:hidden">
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
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="truncate text-[16px] font-bold leading-tight tracking-[-0.01em] text-foreground">
              {w.name}
            </span>
            <span className="truncate font-mono text-[0.66rem] uppercase tracking-[0.14em] text-muted-foreground">
              {w.boardCount} {boardPl(w.boardCount)} · {w.role.toLowerCase()}
            </span>
          </div>
          <ChevronRight size={18} className="shrink-0 text-muted-foreground" />
        </div>

        {/* Desktop-only original head — eyebrow + slug, h2 nazwy, opcjonalny opis */}
        <div className="hidden items-center justify-between md:flex">
          <span className="eyebrow">{w.role.toLowerCase()}</span>
          <span className="font-mono text-[0.68rem] text-muted-foreground">/{w.slug}</span>
        </div>
        <h2 className="hidden font-display text-[1.5rem] font-bold leading-[1.15] tracking-[-0.02em] text-foreground md:block">
          {w.name}
        </h2>
        {w.description && (
          <p className="line-clamp-2 text-[0.9rem] leading-[1.55] text-muted-foreground max-md:hidden">
            {w.description}
          </p>
        )}
        <div className="mt-auto hidden items-center justify-between pt-4 md:flex">
          <span className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-muted-foreground">
            {w.boardCount} {boardPl(w.boardCount)}
          </span>
          <span className="inline-flex items-center gap-1 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors group-hover:text-primary">
            wejdź <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </Link>

      {/* Drag handle — przesunięty na lewą krawędź karty. Mobile: chowamy
          (na touch device reorder via long-press na grip pogarsza UX —
          klient woli swap przez "edit mode" w przyszłej iteracji). */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Przeciągnij aby zmienić kolejność"
        title="Przeciągnij aby zmienić kolejność"
        className="absolute left-3 top-1/2 hidden h-8 w-8 -translate-y-1/2 cursor-grab place-items-center rounded-md text-muted-foreground/50 transition-colors hover:bg-accent hover:text-foreground active:cursor-grabbing md:grid"
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
