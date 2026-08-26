"use client";

// Inline priority editor (Lista cell + task panel). Click → menu of P0–P3 / Brak;
// optimistic local override until the server round-trip lands.

import { useState, useTransition } from "react";
import { PRIORITY_META, PRIORITY_VALUES, type TaskPriorityValue } from "@/lib/task-priority";
import { setTaskPriorityAction } from "@/app/(app)/w/[workspaceId]/t/actions";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { cn } from "@/lib/utils";
import { Menu, MenuContent, MenuRadioGroup, MenuRadioItem, MenuTrigger } from "@/components/ui/dropdown-menu";
import { PriorityIcon, type PriorityLevel } from "@/components/ui/priority-icon";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

export const PRIORITY_LEVEL: Record<TaskPriorityValue, PriorityLevel | null> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3, NONE: null };

export function PriorityGlyph({ value, size = 14, withLabel = true, className }: { value: TaskPriorityValue; size?: number; withLabel?: boolean; className?: string }) {
  const level = PRIORITY_LEVEL[value];
  if (level === null) return <span className={cn("text-n-400", className)}>—</span>;
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <PriorityIcon level={level} size={size} />
      {withLabel && <span className="text-xs leading-none text-foreground">P{level}</span>}
    </span>
  );
}

export function PriorityPickerCell({ taskId, current, canEdit }: { taskId: string; current: TaskPriorityValue; canEdit: boolean }) {
  const [override, setOverride] = useState<TaskPriorityValue | null>(null);
  const optimistic = override ?? current;
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const isMobile = useIsMobile();

  const pick = (next: TaskPriorityValue) => {
    setOpen(false);
    if (next === optimistic) return;
    setOverride(next);
    startTransition(async () => {
      await setTaskPriorityAction({ taskId, priority: next });
      setOverride(null);
    });
  };

  const triggerClass = "inline-flex h-7 max-w-full items-center rounded-sm px-1.5 outline-none enabled:hover:bg-n-100 disabled:cursor-default data-popup-open:bg-n-100";
  const options = PRIORITY_VALUES.map((value) => {
    const level = PRIORITY_LEVEL[value];
    return { value, level, label: PRIORITY_META[value].label, code: PRIORITY_META[value].shortCode };
  });

  if (isMobile) {
    return (
      <>
        <button type="button" disabled={!canEdit} title={canEdit ? "Zmień priorytet" : "Brak uprawnień"} onClick={() => setOpen(true)} className={triggerClass}>
          <PriorityGlyph value={optimistic} />
        </button>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="bottom" showCloseButton={false} className="gap-0 p-0">
            <div className="sheet-drag-handle" aria-hidden="true" />
            <SheetTitle className="px-4 pb-2 pt-3 text-base font-semibold">Priorytet</SheetTitle>
            <div className="flex flex-col px-2 pb-3 safe-bottom" role="menu">
              {options.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  role="menuitemradio"
                  aria-checked={o.value === optimistic}
                  onClick={() => pick(o.value)}
                  className="flex h-11 items-center gap-3 rounded-md px-3 text-left text-sm outline-none active:bg-n-100 aria-checked:bg-n-100"
                >
                  {o.level === null ? <span className="inline-block size-4 rounded-full border border-dashed border-n-400" /> : <PriorityIcon level={o.level} size={16} />}
                  <span className={cn("flex-1", o.level === null && "text-muted-foreground")}>{o.label}</span>
                  <span className="font-mono text-2xs text-n-500">{o.code}</span>
                </button>
              ))}
            </div>
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <Menu open={open} onOpenChange={setOpen}>
      <MenuTrigger disabled={!canEdit} title={canEdit ? "Zmień priorytet" : "Brak uprawnień"} className={triggerClass}>
        <PriorityGlyph value={optimistic} />
      </MenuTrigger>
      <MenuContent align="start" className="w-52">
        <MenuRadioGroup value={optimistic} onValueChange={(v) => pick(v as TaskPriorityValue)}>
          {options.map((o) => (
            <MenuRadioItem key={o.value} value={o.value} closeOnClick>
              {o.level === null ? <span className="inline-block size-3.5 rounded-full border border-dashed border-n-400" /> : <PriorityIcon level={o.level} size={14} />}
              <span className={cn(o.level === null && "text-muted-foreground")}>{o.label}</span>
              <span className="ml-auto pl-2 font-mono text-[10px] text-n-500">{o.code}</span>
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
      </MenuContent>
    </Menu>
  );
}
