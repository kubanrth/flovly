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
import { reorderWorkspacesAction } from "@/app/(app)/workspaces/actions";
import { IconArrowRight, IconMore } from "@/components/ui/icons";
import { boardPl } from "@/lib/pluralize";
import { cn } from "@/lib/utils";

// Drag-and-drop reorder (dnd-kit) — uchwyt po lewej, reszta karty to link.
// Kolejność zapisuje `reorderWorkspacesAction` optymistycznie w tle.

export interface WorkspaceRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  role: string;
  boardCount: number;
}

function initialsFor(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0]![0]! + words[1]![0]!).toUpperCase();
  return (words[0] ?? "??").slice(0, 2).toUpperCase();
}

const HANDLE =
  "grid size-7 shrink-0 cursor-grab place-items-center rounded-md text-n-400 outline-none hover:bg-n-100 hover:text-foreground active:cursor-grabbing active:bg-n-200";

function useReorder(rows: WorkspaceRow[]) {
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
      startTransition(() => {
        void reorderWorkspacesAction(next.map((w) => w.id));
      });
      return next;
    });
  };
  return { items, sensors, onDragEnd };
}

function LetterTile({ name, size }: { name: string; size: 28 | 40 }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-md bg-orange-100 font-semibold text-orange-800",
        size === 40 ? "size-10 text-xs" : "size-7 text-2xs",
      )}
    >
      {initialsFor(name)}
    </span>
  );
}

export function SortableWorkspacesGrid({ rows }: { rows: WorkspaceRow[] }) {
  const { items, sensors, onDragEnd } = useReorder(rows);
  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-input-border px-3.5 py-4 text-center text-xs text-fg-2">
        Brak przestrzeni — utwórz pierwszą.
      </p>
    );
  }
  return (
    <DndContext id="workspaces-grid" sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={items.map((w) => w.id)} strategy={verticalListSortingStrategy}>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {items.map((w) => (
            <SortableWorkspaceCard key={w.id} workspace={w} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableWorkspaceCard({ workspace: w }: { workspace: WorkspaceRow }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: w.id });
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
      className="group flex h-full flex-col rounded-lg border border-border bg-card p-3.5 hover:border-input-border-hover"
    >
      <div className="flex items-start gap-2.5">
        <LetterTile name={w.name} size={40} />
        <Link href={`/w/${w.id}`} className="min-w-0 flex-1 no-underline outline-none">
          <span className="block truncate text-base font-semibold text-foreground group-hover:text-orange-800">
            {w.name}
          </span>
          <span className="block truncate text-2xs text-fg-3">
            {w.boardCount} {boardPl(w.boardCount)} · {w.role.toLowerCase()}
          </span>
        </Link>
        <button type="button" {...attributes} {...listeners} aria-label="Przeciągnij przestrzeń" title="Przeciągnij, aby zmienić kolejność" className={HANDLE}>
          <IconMore width={14} height={14} className="rotate-90" />
        </button>
      </div>

      {w.description && <p className="mt-2 line-clamp-2 text-xs text-fg-2">{w.description}</p>}

      <div className="mt-auto flex items-center gap-2 pt-3">
        <span className="truncate font-mono text-2xs text-fg-3">/{w.slug}</span>
        <Link
          href={`/w/${w.id}`}
          className="ml-auto inline-flex items-center gap-1 text-2xs text-fg-3 no-underline outline-none hover:text-orange-800"
        >
          wejdź <IconArrowRight width={11} height={11} />
        </Link>
      </div>
    </div>
  );
}

export function SortableWorkspacesList({ rows }: { rows: WorkspaceRow[] }) {
  const { items, sensors, onDragEnd } = useReorder(rows);
  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-input-border px-3.5 py-4 text-center text-xs text-fg-2">
        Brak przestrzeni — utwórz pierwszą.
      </p>
    );
  }
  return (
    <DndContext id="workspaces-list" sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={items.map((w) => w.id)} strategy={verticalListSortingStrategy}>
        <ul className="overflow-hidden rounded-lg border border-border">
          {items.map((w) => (
            <SortableWorkspaceRow key={w.id} workspace={w} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function SortableWorkspaceRow({ workspace: w }: { workspace: WorkspaceRow }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: w.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  } as const;

  return (
    <li ref={setNodeRef} style={style} className="flex items-center gap-2 border-b border-n-100 bg-card px-2 last:border-b-0 hover:bg-row-hover">
      <button type="button" {...attributes} {...listeners} aria-label="Przeciągnij" title="Przeciągnij, aby zmienić kolejność" className={HANDLE}>
        <IconMore width={14} height={14} className="rotate-90" />
      </button>
      <Link
        href={`/w/${w.id}`}
        className="group flex min-h-11 flex-1 items-center gap-2.5 py-1.5 no-underline outline-none max-md:flex-wrap"
      >
        <LetterTile name={w.name} size={28} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-medium group-hover:text-orange-800">{w.name}</span>
          <span className="truncate text-2xs text-fg-3">
            /{w.slug}
            {w.description ? ` · ${w.description}` : ""}
          </span>
        </span>
        <span className="shrink-0 text-2xs text-fg-3">{w.role.toLowerCase()}</span>
        <span className="shrink-0 font-mono text-2xs text-fg-3">
          {w.boardCount} {boardPl(w.boardCount)}
        </span>
        <IconArrowRight width={13} height={13} className="shrink-0 text-n-400 group-hover:text-orange-800" />
      </Link>
    </li>
  );
}
