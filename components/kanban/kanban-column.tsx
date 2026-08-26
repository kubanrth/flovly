"use client";

// B4 kolumna: 280px, nagłówek „NAZWA · N” + chip WIP + [+] [⋯], lista kart,
// „Utwórz zadanie” na dole. Zwinięta = 40px z pionowym napisem.

import { startTransition, useEffect, useRef, useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { createTaskAction } from "@/app/(app)/w/[workspaceId]/t/actions";
import { deleteStatusColumnAction, updateStatusColumnAction } from "@/app/(app)/w/[workspaceId]/b/[boardId]/actions";
import { STATUS_PALETTE } from "@/lib/colors";
import { taskPl } from "@/lib/pluralize";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Menu, MenuContent, MenuItem, MenuRadioGroup, MenuRadioItem, MenuSeparator, MenuSub, MenuSubContent, MenuSubTrigger, MenuTrigger } from "@/components/ui/dropdown-menu";
import { IconChevronLeft, IconChevronRight, IconEdit, IconMore, IconPlus, IconTag, IconTrash } from "@/components/ui/icons";
import { NO_STATUS, wipTone, type KanbanStatusColumn, type KanbanTask } from "@/components/kanban/kanban-model";
import { SortableKanbanCard, type CardHoverProps } from "@/components/kanban/kanban-card";
import { useKanbanState } from "@/components/kanban/kanban-state";

const ICON_BTN =
  "inline-flex size-6 shrink-0 items-center justify-center rounded-sm text-n-500 outline-none hover:bg-n-200 hover:text-foreground active:bg-n-300 data-popup-open:bg-n-200";
const WIP_TONE = { yellow: "bg-chip-yellow-bg text-chip-yellow-fg", red: "bg-chip-red-bg text-chip-red-fg" };

export function KanbanColumn({
  id,
  column,
  tasks,
  hoverProps,
}: {
  id: string;
  // null = wirtualna kolumna „Bez statusu”
  column: KanbanStatusColumn | null;
  tasks: KanbanTask[];
  hoverProps?: (task: KanbanTask) => CardHoverProps;
}) {
  const s = useKanbanState();
  const [adding, setAdding] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const { setNodeRef, isOver } = useDroppable({ id: `col:${id}` });
  const name = column?.name ?? "Bez statusu";
  const collapsed = s.collapsed.includes(id);
  const limit = s.wip[id] ?? null;
  const tone = wipTone(tasks.length, limit);
  const canAdd = s.canCreate && id !== NO_STATUS;

  const save = (patch: { name?: string; colorHex?: string }) => {
    if (!column) return;
    const fd = new FormData();
    fd.set("workspaceId", s.workspaceId);
    fd.set("columnId", column.id);
    fd.set("name", patch.name ?? column.name);
    fd.set("colorHex", patch.colorHex ?? column.colorHex);
    startTransition(() => updateStatusColumnAction(fd));
  };
  const remove = () => {
    if (!column) return;
    const fd = new FormData();
    fd.set("workspaceId", s.workspaceId);
    fd.set("columnId", column.id);
    startTransition(() => deleteStatusColumnAction(fd));
  };

  if (collapsed) {
    return (
      <button
        type="button"
        data-ui="kanban-column"
        data-collapsed=""
        data-column-id={id}
        onClick={() => s.toggleCollapsed(id)}
        aria-label={`Rozwiń kolumnę ${name}`}
        className="flex h-[360px] w-10 shrink-0 flex-col items-center gap-2 rounded-lg border border-border bg-n-100 py-2 outline-none hover:bg-n-200 active:bg-n-300"
      >
        <IconChevronRight width={12} height={12} className="text-n-500" />
        <span className="eyebrow text-fg-2 [writing-mode:vertical-rl]">{name} · {tasks.length}</span>
      </button>
    );
  }

  return (
    <section data-ui="kanban-column" data-column-id={id} aria-label={`Kolumna ${name}, ${tasks.length} ${taskPl(tasks.length)}`} className="w-[280px] shrink-0">
      <div className="flex h-8 items-center gap-1.5 px-1">
        {renaming && column ? (
          <ColumnNameInput
            defaultValue={column.name}
            onCancel={() => setRenaming(false)}
            onSave={(next) => {
              setRenaming(false);
              if (next && next !== column.name) save({ name: next });
            }}
          />
        ) : (
          <>
            <span className="eyebrow min-w-0 truncate text-fg-2">{name}</span>
            <span className="shrink-0 font-mono text-2xs leading-none text-fg-3">· {tasks.length}</span>
            {tone && (
              <span className={cn("inline-flex h-4 shrink-0 items-center rounded-lg px-[5px] text-[10px] font-semibold leading-none", WIP_TONE[tone])}>
                WIP {tasks.length}/{limit}
              </span>
            )}
            <span className="flex-1" />
            {canAdd && (
              <button type="button" aria-label={`Dodaj zadanie do kolumny ${name}`} onClick={() => setAdding(true)} className={ICON_BTN}>
                <IconPlus width={14} height={14} />
              </button>
            )}
            <Menu>
              <MenuTrigger aria-label={`Opcje kolumny ${name}`} className={ICON_BTN}>
                <IconMore width={14} height={14} />
              </MenuTrigger>
              <MenuContent align="end" data-ui="kanban-column-menu">
                <MenuItem icon={<IconChevronLeft />} onClick={() => s.toggleCollapsed(id)}>Zwiń kolumnę</MenuItem>
                {column && s.canManageBoard && (
                  <>
                    <MenuItem icon={<IconEdit />} onClick={() => setRenaming(true)}>Zmień nazwę</MenuItem>
                    <MenuSub>
                      <MenuSubTrigger icon={<IconTag />}>Kolor</MenuSubTrigger>
                      <MenuSubContent className="min-w-0">
                        <div className="grid grid-cols-4 gap-1 p-1">
                          {STATUS_PALETTE.map((c) => (
                            <button
                              key={c}
                              type="button"
                              aria-label={`Kolor ${c}`}
                              onClick={() => save({ colorHex: c })}
                              style={{ background: c }}
                              className={cn(
                                "size-6 rounded-full outline-none hover:shadow-[0_0_0_2px_var(--n-300)] active:shadow-[0_0_0_2px_var(--n-400)]",
                                column.colorHex.toLowerCase() === c.toLowerCase() && "shadow-[0_0_0_2px_var(--control-on)]",
                              )}
                            />
                          ))}
                        </div>
                      </MenuSubContent>
                    </MenuSub>
                    <MenuSub>
                      <MenuSubTrigger icon={<IconMore />}>Limit WIP</MenuSubTrigger>
                      <MenuSubContent>
                        <MenuRadioGroup value={String(limit ?? "")} onValueChange={(v) => s.setWip(id, v ? Number(v) : null)}>
                          <MenuRadioItem value="" closeOnClick>Bez limitu</MenuRadioItem>
                          {[3, 5, 8, 10].map((n) => (
                            <MenuRadioItem key={n} value={String(n)} closeOnClick>{n} zadań</MenuRadioItem>
                          ))}
                        </MenuRadioGroup>
                      </MenuSubContent>
                    </MenuSub>
                    <MenuSeparator />
                    <MenuItem icon={<IconTrash />} destructive onClick={remove}>Usuń</MenuItem>
                  </>
                )}
              </MenuContent>
            </Menu>
          </>
        )}
      </div>

      <div
        ref={setNodeRef}
        className={cn("flex flex-col gap-2 rounded-lg", isOver && tasks.length === 0 && "bg-orange-50")}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((t) => (
            <SortableKanbanCard key={t.id} task={t} workspaceId={s.workspaceId} disabled={!s.canEdit} hoverProps={hoverProps?.(t)} />
          ))}
        </SortableContext>
        {tasks.length === 0 && !adding && (
          <p className="rounded-lg border border-dashed border-input-border px-3 py-5 text-center text-xs text-fg-3">Upuść zadanie tutaj</p>
        )}
        {canAdd && <QuickAdd columnId={id} open={adding} onOpenChange={setAdding} />}
      </div>
    </section>
  );
}

function ColumnNameInput({ defaultValue, onSave, onCancel }: { defaultValue: string; onSave: (v: string) => void; onCancel: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.select(), []);
  return (
    <Input
      ref={ref}
      size="sm"
      defaultValue={defaultValue}
      maxLength={40}
      aria-label="Nazwa kolumny"
      className="h-6 text-2xs font-semibold uppercase tracking-[.06em]"
      onBlur={(e) => onSave(e.currentTarget.value.trim())}
      onKeyDown={(e) => {
        if (e.key === "Enter") { e.preventDefault(); onSave(e.currentTarget.value.trim()); }
        if (e.key === "Escape") { e.preventDefault(); onCancel(); }
      }}
    />
  );
}

// „Utwórz zadanie” — po Enterze pole zostaje otwarte na kolejne zadanie.
function QuickAdd({ columnId, open, onOpenChange }: { columnId: string; open: boolean; onOpenChange: (v: boolean) => void }) {
  const s = useKanbanState();
  const [title, setTitle] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (open) ref.current?.focus(); }, [open]);

  const submit = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    const fd = new FormData();
    fd.set("workspaceId", s.workspaceId);
    fd.set("boardId", s.boardId);
    fd.set("title", trimmed);
    fd.set("statusColumnId", columnId);
    if (s.viewId) fd.set("viewId", s.viewId);
    setTitle("");
    startTransition(async () => { await createTaskAction(null, fd); });
  };

  if (!open) {
    return (
      <button
        type="button"
        data-ui="kanban-add-task"
        onClick={() => onOpenChange(true)}
        className="flex h-8 w-full items-center gap-1.5 rounded-md px-1 text-left text-sm text-fg-2 outline-none hover:bg-n-100 hover:text-foreground active:bg-n-200"
      >
        <IconPlus width={13} height={13} />
        Utwórz zadanie
      </button>
    );
  }
  return (
    <div className="rounded-lg border border-orange-500 bg-card px-3 py-2.5">
      <input
        ref={ref}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); submit(); }
          if (e.key === "Escape") { e.preventDefault(); setTitle(""); onOpenChange(false); }
        }}
        onBlur={() => { if (!title.trim()) onOpenChange(false); }}
        maxLength={200}
        placeholder="Tytuł zadania…"
        aria-label="Tytuł nowego zadania"
        className="w-full bg-transparent text-sm leading-[18px] outline-none placeholder:text-fg-3"
      />
      <p className="mt-1 font-mono text-[10px] text-fg-3">Enter — dodaj · Esc — zamknij</p>
    </div>
  );
}
