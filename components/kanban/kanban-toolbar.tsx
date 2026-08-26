"use client";

// BoardToolbar wired to Tablica state (szukaj · osoby · priorytet · Grupuj · Sortuj · ⋯).

import { PRIORITY_META, PRIORITY_VALUES } from "@/lib/task-priority";
import { BoardToolbar } from "@/components/view/board-toolbar";
import { MenuItem, MenuRadioGroup, MenuRadioItem, MenuSeparator } from "@/components/ui/dropdown-menu";
import { IconColumns, IconCopy } from "@/components/ui/icons";
import { PriorityIcon } from "@/components/ui/priority-icon";
import { useToast } from "@/components/ui/toast";
import { PRIORITY_LEVEL } from "@/components/table/priority-picker-cell";
import { GROUP_LABEL, SORT_LABEL, memberLabel, type KanbanGroupBy, type KanbanSort } from "@/components/kanban/kanban-model";
import { useKanbanState } from "@/components/kanban/kanban-state";

export function KanbanToolbar() {
  const s = useKanbanState();
  const toast = useToast();
  const allCollapsed = s.statusColumns.length > 0 && s.statusColumns.every((c) => s.collapsed.includes(c.id));

  return (
    <BoardToolbar
      search={s.search}
      onSearch={s.setSearch}
      people={s.members.map((m) => ({ id: m.id, name: memberLabel(m), avatarUrl: m.avatarUrl }))}
      activePeople={s.people}
      onTogglePerson={s.togglePerson}
      filterButtons={[
        {
          label: "Priorytet",
          active: Boolean(s.priority),
          menu: (
            <MenuRadioGroup value={s.priority ?? ""} onValueChange={(v) => s.setPriority(v ? (String(v) as typeof s.priority) : null)}>
              <MenuRadioItem value="" closeOnClick>Dowolny</MenuRadioItem>
              {PRIORITY_VALUES.filter((p) => p !== "NONE").map((p) => (
                <MenuRadioItem key={p} value={p} closeOnClick>
                  <PriorityIcon level={PRIORITY_LEVEL[p]!} size={14} />
                  {PRIORITY_META[p].shortCode} {PRIORITY_META[p].label}
                </MenuRadioItem>
              ))}
            </MenuRadioGroup>
          ),
        },
      ]}
      groupLabel={`Grupuj: ${GROUP_LABEL[s.groupBy]}`}
      groupActive={s.groupBy !== "status"}
      groupMenu={
        <MenuRadioGroup value={s.groupBy} onValueChange={(v) => s.setGroupBy(String(v) as KanbanGroupBy)}>
          {(Object.keys(GROUP_LABEL) as KanbanGroupBy[]).map((g) => (
            <MenuRadioItem key={g} value={g} closeOnClick>{GROUP_LABEL[g]}</MenuRadioItem>
          ))}
        </MenuRadioGroup>
      }
      sortLabel={s.sort === "manual" ? "Sortuj" : `Sortuj: ${SORT_LABEL[s.sort]}`}
      sortActive={s.sort !== "manual"}
      sortMenu={
        <MenuRadioGroup value={s.sort} onValueChange={(v) => s.setSort(String(v) as KanbanSort)}>
          {(Object.keys(SORT_LABEL) as KanbanSort[]).map((k) => (
            <MenuRadioItem key={k} value={k} closeOnClick>{SORT_LABEL[k]}</MenuRadioItem>
          ))}
        </MenuRadioGroup>
      }
      more={
        <>
          <MenuItem
            icon={<IconColumns />}
            onClick={() => s.setCollapsedAll(allCollapsed ? [] : s.statusColumns.map((c) => c.id))}
          >
            {allCollapsed ? "Rozwiń wszystkie kolumny" : "Zwiń wszystkie kolumny"}
          </MenuItem>
          <MenuSeparator />
          <MenuItem
            icon={<IconCopy />}
            onClick={() => {
              void navigator.clipboard.writeText(window.location.href);
              toast.add({ title: "Skopiowano link do widoku" });
            }}
          >
            Kopiuj link do widoku
          </MenuItem>
        </>
      }
    />
  );
}
