"use client";

import { startTransition, useState } from "react";
import { patchTaskAction, setTaskPriorityAction } from "@/app/(app)/w/[workspaceId]/t/actions";
import { Menu, MenuTrigger, MenuContent, MenuRadioGroup, MenuRadioItem } from "@/components/ui/dropdown-menu";
import { Chip } from "@/components/ui/chip";
import { Kbd } from "@/components/ui/kbd";
import { PriorityIcon, PRIORITY_LABEL, type PriorityLevel } from "@/components/ui/priority-icon";
import { IconChevronDown } from "@/components/ui/icons";
import { hueForColor } from "@/components/ui/status-hue";
import type { TaskPriorityValue } from "@/lib/task-priority";
import { cn } from "@/lib/utils";

export interface StatusOption { id: string; name: string; colorHex: string }

// Header status chip with chevron → "big dropdown" (menu radio list). Optimistic; patchTaskAction.
export function StatusChipMenu({ taskId, statusColumns, value, canEdit, onMutate, className }: {
  taskId: string; statusColumns: StatusOption[]; value: string | null; canEdit: boolean; onMutate?: () => void; className?: string;
}) {
  const [local, setLocal] = useState(value ?? "");
  const [prev, setPrev] = useState(value);
  if (value !== prev) { setPrev(value); setLocal(value ?? ""); }
  const current = statusColumns.find((s) => s.id === local) ?? null;
  const pick = (next: string) => {
    if (next === local) return;
    setLocal(next);
    onMutate?.();
    const fd = new FormData();
    fd.set("id", taskId);
    fd.set("statusColumnId", next);
    startTransition(() => patchTaskAction(fd));
  };
  return (
    <Menu>
      <MenuTrigger disabled={!canEdit} title="Zmień status" className="rounded-sm outline-none disabled:cursor-default">
        <Chip hue={current ? hueForColor(current.colorHex) : "gray"} dot size="lg" className={cn("h-[26px] cursor-pointer gap-1.5 px-[9px] text-xs", !canEdit && "cursor-default", className)}>
          {current?.name ?? "Brak statusu"}
          {canEdit && <IconChevronDown width={12} height={12} className="-mr-0.5" />}
        </Chip>
      </MenuTrigger>
      <MenuContent align="start" className="min-w-[200px]">
        <MenuRadioGroup value={local} onValueChange={(v) => pick(String(v))}>
          <MenuRadioItem value=""><span className="size-1.5 rounded-full border border-n-400" /> — brak —</MenuRadioItem>
          {statusColumns.map((s) => (
            <MenuRadioItem key={s.id} value={s.id}>
              <Chip hue={hueForColor(s.colorHex)} dot size="md">{s.name}</Chip>
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
      </MenuContent>
    </Menu>
  );
}

const LEVEL: Record<Exclude<TaskPriorityValue, "NONE">, PriorityLevel> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
const VALUES: TaskPriorityValue[] = ["URGENT", "HIGH", "MEDIUM", "LOW", "NONE"];
const TEXT: Record<PriorityLevel, string> = { 0: "text-danger-text", 1: "text-orange-700", 2: "text-warning-text", 3: "text-n-500" };

export function priorityLabel(p: TaskPriorityValue, short = false): string {
  if (p === "NONE") return "Priorytet";
  const l = LEVEL[p];
  return short ? `P${l}` : `P${l} ${PRIORITY_LABEL[l]}`;
}

// Header priority chip (bordered) → radio menu with PriorityIcon + Kbd code. setTaskPriorityAction, optimistic.
export function PriorityChipMenu({ taskId, value, canEdit, short, onMutate, className }: {
  taskId: string; value: TaskPriorityValue; canEdit: boolean; short?: boolean; onMutate?: () => void; className?: string;
}) {
  const [local, setLocal] = useState(value);
  const [prev, setPrev] = useState(value);
  if (value !== prev) { setPrev(value); setLocal(value); }
  const level = local === "NONE" ? null : LEVEL[local];
  const pick = (next: TaskPriorityValue) => {
    if (next === local) return;
    setLocal(next);
    onMutate?.();
    startTransition(async () => { await setTaskPriorityAction({ taskId, priority: next }); });
  };
  return (
    <Menu>
      <MenuTrigger
        disabled={!canEdit}
        title="Zmień priorytet"
        className={cn("inline-flex h-[26px] items-center gap-[5px] rounded-sm border border-border bg-card px-2 text-xs font-medium outline-none hover:bg-n-50 disabled:cursor-default disabled:hover:bg-card", level === null ? "border-dashed text-n-500" : TEXT[level], className)}
      >
        {level !== null && <PriorityIcon level={level} size={14} />}
        {priorityLabel(local, short)}
      </MenuTrigger>
      <MenuContent align="start" className="min-w-[200px]">
        <MenuRadioGroup value={local} onValueChange={(v) => pick(v as TaskPriorityValue)}>
          {VALUES.map((v) => {
            const l = v === "NONE" ? null : LEVEL[v];
            return (
              <MenuRadioItem key={v} value={v}>
                {l !== null ? <PriorityIcon level={l} size={14} /> : <span className="size-3.5" />}
                <span className={cn("flex-1", l === null && "text-n-500")}>{l !== null ? PRIORITY_LABEL[l] : "Brak"}</span>
                {l !== null && <Kbd className="mr-5">P{l}</Kbd>}
              </MenuRadioItem>
            );
          })}
        </MenuRadioGroup>
      </MenuContent>
    </Menu>
  );
}
