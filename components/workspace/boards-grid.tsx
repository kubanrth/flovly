"use client";

// C1 boards grid: 3 columns of board cards + the dashed „Nowa tablica” tile.
// Drag-reorder (dnd-kit → `reorderBoardsAction`) is kept from v4.

import { startTransition, useState } from "react";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { reorderBoardsAction } from "@/app/(app)/w/[workspaceId]/b/actions";
import { EmptyState } from "@/components/ui/empty-state";
import { IconBoards } from "@/components/ui/icons";
import { BoardCard, swallowNextClick, type BoardCardData } from "./board-card";
import { NewBoardButton } from "./new-board-button";

export function BoardsGrid({
  workspaceId,
  boards,
  canCreate,
  enabledViews,
  autoOpenCreate = false,
}: {
  workspaceId: string;
  boards: BoardCardData[];
  canCreate: boolean;
  enabledViews: string[];
  autoOpenCreate?: boolean;
}) {
  const [items, setItems] = useState(boards);
  const [prev, setPrev] = useState(boards);
  if (prev !== boards) {
    setPrev(boards);
    setItems(boards);
  }
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    swallowNextClick();
    if (!over || active.id === over.id) return;
    const next = arrayMove(
      items,
      items.findIndex((b) => b.id === active.id),
      items.findIndex((b) => b.id === over.id),
    );
    setItems(next);
    startTransition(() => void reorderBoardsAction(workspaceId, next.map((b) => b.id)));
  };

  if (items.length === 0 && !canCreate) {
    return <EmptyState icon={IconBoards} title="Brak tablic" description="Nie masz jeszcze dostępu do żadnej tablicy w tej przestrzeni." />;
  }

  return (
    <DndContext id="workspace-boards" sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={items.map((b) => b.id)} strategy={rectSortingStrategy}>
        <ul className="grid grid-cols-3 gap-3 max-lg:grid-cols-2 max-md:grid-cols-1">
          {items.map((b) => (
            <BoardCard key={b.id} workspaceId={workspaceId} board={b} canDrag={canCreate} />
          ))}
          {canCreate && (
            <li className="flex">
              <NewBoardButton
                workspaceId={workspaceId}
                enabledViews={enabledViews}
                variant="tile"
                autoOpen={autoOpenCreate}
              />
            </li>
          )}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
