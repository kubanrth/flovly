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
      {/* Karta v4 — ten sam pattern co board card w sortable-boards.tsx:
          liquid-glass + 3px top accent strip + 38px init badge + spring hover. */}
      <div className="relative flex h-full flex-col gap-3.5 overflow-hidden rounded-2xl border border-border/70 bg-card/70 p-5 pl-12 backdrop-blur-xl shadow-[0_1px_0_rgba(255,255,255,.6)_inset,0_14px_30px_-18px_rgba(76,29,149,.30)] transition-[transform,box-shadow,border-color] duration-300 [transition-timing-function:cubic-bezier(.34,1.56,.64,1)] group-hover:-translate-y-[3px] group-hover:border-primary/30 group-hover:shadow-[0_1px_0_rgba(255,255,255,.7)_inset,0_22px_44px_-18px_rgba(76,29,149,.45),0_30px_70px_-24px_rgba(225,49,143,.20)] max-md:min-h-[200px] md:h-[200px]">
        {/* 3px top accent strip — workspace color identity (ZAWSZE, nie tylko mobile) */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[3px]"
          style={{ background: swatch.color }}
        />

        <Link
          href={`/w/${w.id}`}
          className="flex min-w-0 flex-col gap-2.5 focus-visible:outline-none"
        >
          {/* HEAD: init badge + eyebrow/nazwa/meta + counter pill */}
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
              <span className="eyebrow">Przestrzeń</span>
              <h2 className="mt-1 truncate font-display text-[1.05rem] font-bold leading-tight tracking-[-0.015em] text-foreground transition-colors group-hover:text-primary">
                {w.name}
              </h2>
              <p className="mt-0.5 truncate font-mono text-[0.66rem] uppercase tracking-[0.14em] text-muted-foreground">
                {w.boardCount} {boardPl(w.boardCount)} · {w.role.toLowerCase()}
              </p>
            </div>
            {/* Boards counter — brand-tinted pill (matches board card) */}
            <span className="shrink-0 rounded-lg bg-primary/10 px-2 py-1 font-mono text-[0.66rem] font-semibold text-primary">
              {w.boardCount}
            </span>
          </div>

          {/* Opis (opcjonalnie) — mt-auto żeby kafelki miały równą wysokość */}
          {w.description && (
            <p className="line-clamp-2 text-[0.85rem] leading-[1.5] text-muted-foreground">
              {w.description}
            </p>
          )}
        </Link>

        {/* Footer row — slug pill po lewej + "wejdź" arrow po prawej (mt-auto) */}
        <div className="-mx-1 mt-auto flex flex-wrap items-center gap-1.5 px-1 pb-0.5">
          <span className="inline-flex h-7 items-center rounded-lg border border-border/60 bg-background/70 px-2 font-mono text-[0.62rem] font-medium uppercase tracking-[0.12em] text-muted-foreground backdrop-blur-sm">
            /{w.slug}
          </span>
          <span className="ml-auto inline-flex items-center gap-1 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-muted-foreground transition-colors group-hover:text-primary">
            wejdź <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>

        {/* Mobile-only chevron jako sygnał "klikalne" — desktop ma "wejdź" arrow */}
        <ChevronRight
          size={18}
          className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/50 md:hidden"
        />
      </div>

      {/* Drag handle po lewej krawędzi karty — wyciszony, ujawnia się na hover.
          Mobile: chowamy (touch reorder via long-press, mniej intuicyjne UX). */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Przeciągnij przestrzeń"
        title="Przeciągnij aby zmienić kolejność"
        className="absolute left-3 top-[18px] hidden h-8 w-8 cursor-grab place-items-center rounded-md text-muted-foreground/40 transition-colors hover:bg-accent hover:text-foreground active:cursor-grabbing md:grid"
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

  const swatch = useMemo(() => swatchFor(w.id), [w.id]);
  const initials = useMemo(() => initialsFor(w.name), [w.name]);

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
        {/* F12-K110: dodany init badge (workspace color identity) na mobile
            i desktop — mirror SortableBoardRow z F12-K108. Wcześniej list
            view nie miał badge'a, kafelki miały — visual mismatch między
            modes na desktopie i między mobile/desktop. */}
        <Link
          href={`/w/${w.id}`}
          className="group flex flex-1 flex-col gap-2 px-3 py-3 transition-colors hover:bg-accent/60 focus-visible:bg-accent/60 focus-visible:outline-none md:grid md:grid-cols-[40px_minmax(0,1fr)_90px_130px_30px] md:items-center md:gap-4 md:py-3.5"
        >
          {/* TOP row mobile / col 1+2 desktop: badge + nazwa */}
          <div className="flex min-w-0 items-center gap-3 md:contents">
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

            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate font-display text-[1.05rem] font-semibold leading-tight tracking-[-0.01em] transition-colors group-hover:text-primary">
                {w.name}
              </span>
              <span className="truncate font-mono text-[0.66rem] uppercase tracking-[0.14em] text-muted-foreground">
                /{w.slug}
                {w.description ? ` · ${w.description}` : ""}
              </span>
            </div>
          </div>

          {/* BOTTOM row mobile / col 3+4+5 desktop: role + boards + arrow */}
          <div className="flex items-center gap-2 max-md:pl-[48px] md:contents">
            <span className="inline-flex shrink-0 items-center rounded-full border border-border bg-card px-2 py-0.5 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-muted-foreground md:rounded-none md:border-0 md:bg-transparent md:px-0">
              {w.role.toLowerCase()}
            </span>
            <span className="inline-flex shrink-0 items-center rounded-full border border-border bg-card px-2 py-0.5 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-muted-foreground md:rounded-none md:border-0 md:bg-transparent md:px-0">
              {w.boardCount} {boardPl(w.boardCount)}
            </span>
            <ArrowRight
              size={14}
              className="ml-auto shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary md:ml-0 md:justify-self-end"
            />
          </div>
        </Link>
      </div>
    </li>
  );
}
