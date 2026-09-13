"use client";

// F15: komórka „Kategoria" na Liście — ten sam wygląd co pole wyboru, ale
// zapis idzie do Task.categoryId (setTaskCategoryAction), nie do wartości kolumny.

import { startTransition } from "react";
import { setTaskCategoryAction } from "@/app/(app)/w/[workspaceId]/b/[boardId]/category-actions";
import { Chip } from "@/components/ui/chip";
import { Menu, MenuContent, MenuItem, MenuRadioGroup, MenuRadioItem, MenuTrigger } from "@/components/ui/dropdown-menu";
import { hueForColor } from "@/components/ui/status-hue";
import type { TaskCategoryRef } from "@/components/table/types";

const TRIGGER = "inline-flex h-7 max-w-full items-center gap-1 rounded-sm px-1 text-left outline-none hover:bg-n-100 data-popup-open:bg-n-100";

export function CategoryCell({ taskId, current, categories, canEdit }: {
  taskId: string;
  current: TaskCategoryRef | null;
  categories: TaskCategoryRef[];
  canEdit: boolean;
}) {
  const chip = current ? <Chip hue={hueForColor(current.colorHex)} size="md">{current.name}</Chip> : null;
  if (!canEdit) return chip ?? <span className="text-n-400">—</span>;
  const commit = (categoryId: string) => {
    const fd = new FormData();
    fd.set("taskId", taskId);
    fd.set("categoryId", categoryId);
    startTransition(() => { void setTaskCategoryAction(fd); });
  };
  return (
    <Menu>
      <MenuTrigger aria-label="Wybierz kategorię" className={TRIGGER}>
        {chip ?? <span className="inline-flex h-5 items-center rounded-sm border border-dashed border-n-300 px-[7px] text-2xs text-fg-3">wybierz…</span>}
      </MenuTrigger>
      <MenuContent align="start" className="w-48">
        {categories.length === 0 && <MenuItem disabled>Brak kategorii — dodaj je pod przyciskiem „Kategorie”</MenuItem>}
        <MenuRadioGroup value={current?.id ?? ""} onValueChange={(v) => commit(String(v) === (current?.id ?? "") ? "" : String(v))}>
          {categories.map((c) => (
            <MenuRadioItem key={c.id} value={c.id} closeOnClick><Chip hue={hueForColor(c.colorHex)} size="sm">{c.name}</Chip></MenuRadioItem>
          ))}
        </MenuRadioGroup>
      </MenuContent>
    </Menu>
  );
}
