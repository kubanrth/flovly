"use client";

// Lista <768px (B1-mobile): cards in a rounded container, group headers as
// dividers, footer counter, full-width „Dodaj zadanie” pinned to the bottom.

import { useState } from "react";
import Link from "next/link";
import { CreateTaskDialog } from "@/components/task/create-task-button";
import { taskPl, plPlural } from "@/lib/pluralize";
import { cn } from "@/lib/utils";
import { AvatarStack } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { StatusChip, TagChip } from "@/components/ui/chip";
import { IconChevronDown, IconPlus } from "@/components/ui/icons";
import { PriorityIcon } from "@/components/ui/priority-icon";
import type { GroupBucket } from "@/components/table/grouping";
import { PRIORITY_LEVEL } from "@/components/table/priority-picker-cell";
import { RowHints } from "@/components/table/row-hints";
import { hueForColor } from "@/components/ui/status-hue";
import { memberName, type BoardTableColumn } from "@/components/table/types";

export function MobileList({
  workspaceId,
  boardId,
  viewId,
  groups,
  grouped,
  collapsed,
  onToggleGroup,
  selection,
  onToggleSelect,
  statusColumns,
  canEdit,
  total,
  formatDay,
  now,
}: {
  workspaceId: string;
  boardId: string;
  viewId?: string;
  groups: GroupBucket[];
  grouped: boolean;
  collapsed: Set<string>;
  onToggleGroup: (key: string) => void;
  selection: Record<string, boolean>;
  onToggleSelect: (id: string, shift: boolean) => void;
  statusColumns: BoardTableColumn[];
  canEdit: boolean;
  total: number;
  formatDay: (d: Date) => string;
  now: number;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const shown = groups.reduce((n, g) => n + g.rows.length, 0);
  const selectedCount = Object.values(selection).filter(Boolean).length;
  const statusById = new Map(statusColumns.map((s) => [s.id, s]));

  return (
    <div data-ui="list-mobile" className="flex min-h-[calc(100dvh-48px)] flex-col bg-canvas px-4 pb-24 pt-2.5">
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {shown === 0 && <p className="px-4 py-10 text-center text-sm text-muted-foreground">Brak zadań</p>}
        {groups.map((g) => (
          <div key={g.key}>
            {grouped && (
              <button
                type="button"
                data-ui="group-header"
                aria-expanded={!collapsed.has(g.key)}
                onClick={() => onToggleGroup(g.key)}
                className="flex h-9 w-full items-center gap-2 border-b border-border bg-canvas px-3 text-left outline-none"
              >
                <IconChevronDown width={12} height={12} className={cn("shrink-0 text-fg-2", collapsed.has(g.key) && "-rotate-90")} />
                <StatusChip label={g.label} hue={g.hue} size="md" />
                <span className="text-xs text-fg-2">
                  {g.rows.length} {taskPl(g.rows.length)}
                  {collapsed.has(g.key) && " · zwinięte"}
                </span>
              </button>
            )}
            {!collapsed.has(g.key) &&
              g.rows.map((t) => {
                const st = t.statusColumnId ? statusById.get(t.statusColumnId) : undefined;
                const level = PRIORITY_LEVEL[t.priority];
                const stop = t.stopAt ? new Date(t.stopAt) : null;
                const selected = !!selection[t.id];
                return (
                  <div
                    key={t.id}
                    data-ui="list-row"
                    data-task-id={t.id}
                    data-selected={selected || undefined}
                    className="flex gap-2.5 border-b border-n-100 p-3 last:border-b-0 data-selected:bg-selected data-selected:shadow-[inset_2px_0_0_var(--orange-500)]"
                  >
                    {canEdit && (
                      <Checkbox
                        size="md"
                        className="mt-0.5"
                        ariaLabel={`Zaznacz wiersz ${t.title}`}
                        checked={selected}
                        onClick={(e) => onToggleSelect(t.id, e.shiftKey)}
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <Link href={`/w/${workspaceId}/t/${t.id}`} className={cn("block text-sm font-medium leading-[18px] text-foreground hover:text-foreground", selected && "font-medium")}>
                        {t.title}
                      </Link>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-2xs text-fg-3">#{t.displayId}</span>
                        {st && <StatusChip label={st.name} hue={hueForColor(st.colorHex)} size="md" />}
                        {level !== null && <PriorityIcon level={level} size={14} />}
                        {t.tags.map((tag) => <TagChip key={tag.id} label={tag.name} hue={hueForColor(tag.colorHex)} size="sm" />)}
                        {stop && <span className={cn("text-2xs text-fg-2", stop.getTime() < now && "font-medium text-danger-text")}>{formatDay(stop)}</span>}
                        <RowHints task={t} />
                      </div>
                    </div>
                    {t.assignees.length > 0 && (
                      <AvatarStack people={t.assignees.map((a) => ({ name: memberName(a), src: a.avatarUrl }))} size={24} max={2} className="mt-0.5 shrink-0" />
                    )}
                  </div>
                );
              })}
          </div>
        ))}
      </div>
      <p className="py-3 text-center font-mono text-2xs text-fg-3">
        {shown === total ? `${total} ${taskPl(total)}` : `${shown} z ${total} ${taskPl(total)}`}
        {selectedCount > 0 && ` · ${selectedCount} ${plPlural(selectedCount, "zaznaczone", "zaznaczone", "zaznaczonych")}`}
      </p>
      {canEdit && (
        <div className="safe-bottom fixed inset-x-0 bottom-0 z-40 bg-canvas p-3">
          <Button size="lg" className="h-11 w-full" onClick={() => setCreateOpen(true)}>
            <IconPlus width={16} height={16} />
            Dodaj zadanie
          </Button>
          <CreateTaskDialog workspaceId={workspaceId} boardId={boardId} viewId={viewId} open={createOpen} onOpenChange={setCreateOpen} />
        </div>
      )}
    </div>
  );
}
