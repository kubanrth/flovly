"use client";

// B4-mobile: jedna kolumna naraz. Pasek chipów statusów u góry (aktywny ma
// obwódkę), lista kart, licznik i „Utwórz zadanie” 44px przypięte na dole.

import { useState } from "react";
import { CreateTaskDialog } from "@/components/task/create-task-button";
import { taskPl } from "@/lib/pluralize";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CHIP_HUE } from "@/components/ui/chip";
import { IconPlus } from "@/components/ui/icons";
import { hueForColor } from "@/components/ui/status-hue";
import { KanbanCard } from "@/components/kanban/kanban-card";
import { useKanbanState } from "@/components/kanban/kanban-state";
import type { KanbanStatusColumn, KanbanTask } from "@/components/kanban/kanban-model";

export function KanbanMobile({
  buckets,
  columnIds,
  columnById,
}: {
  buckets: Map<string, KanbanTask[]>;
  columnIds: string[];
  columnById: Map<string, KanbanStatusColumn>;
}) {
  const s = useKanbanState();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  // Kolumna mogła zniknąć (filtr, usunięcie) — spadamy wtedy na pierwszą istniejącą.
  const active = activeId && columnIds.includes(activeId) ? activeId : columnIds[0] ?? null;

  const tasks = active ? buckets.get(active) ?? [] : [];
  const activeName = active ? columnById.get(active)?.name ?? "Bez statusu" : "—";

  return (
    <div data-ui="kanban-mobile" className="flex min-h-[calc(100dvh-48px)] w-full flex-col bg-canvas pb-24">
      <div className="no-scrollbar flex w-full gap-1.5 overflow-x-auto border-b border-border bg-card px-4 py-2.5">
        {columnIds.map((id) => {
          const col = columnById.get(id);
          const hue = col ? hueForColor(col.colorHex) : "gray";
          const on = id === active;
          return (
            <button
              key={id}
              type="button"
              data-ui="kanban-status-chip"
              data-active={on ? "" : undefined}
              aria-pressed={on}
              onClick={() => setActiveId(id)}
              className={cn(
                "inline-flex h-8 shrink-0 items-center whitespace-nowrap rounded-sm px-3 text-xs font-medium outline-none",
                CHIP_HUE[hue],
                on ? "font-semibold shadow-[0_0_0_2px_var(--card),0_0_0_3px_currentColor]" : "opacity-80 hover:opacity-100 active:opacity-100",
              )}
            >
              {col?.name ?? "Bez statusu"} · {(buckets.get(id) ?? []).length}
            </button>
          );
        })}
      </div>

      <div className="flex flex-1 flex-col gap-2 px-4 py-3">
        {tasks.map((t) => (
          <KanbanCard key={t.id} task={t} workspaceId={s.workspaceId} mobile />
        ))}
        {tasks.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">Brak zadań w tej kolumnie</p>}
        <p className="py-1.5 text-center font-mono text-2xs text-fg-3">
          kolumna „{activeName}” · {tasks.length} {taskPl(tasks.length)}
        </p>
      </div>

      {s.canCreate && (
        <div className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card p-3">
          <Button size="lg" className="h-11 w-full text-base" onClick={() => setCreateOpen(true)}>
            <IconPlus width={16} height={16} />
            Utwórz zadanie
          </Button>
          <CreateTaskDialog workspaceId={s.workspaceId} boardId={s.boardId} viewId={s.viewId} open={createOpen} onOpenChange={setCreateOpen} />
        </div>
      )}
    </div>
  );
}
