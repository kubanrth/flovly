"use client";

// Floating bulk actions pill (B1): „N zaznaczonych | Status ▾ Priorytet ▾ Przypisz Tag | Usuń ✕”.

import { startTransition } from "react";
import { useRouter } from "next/navigation";
import { bulkAssignAction, bulkDeleteTasksAction, bulkSetPriorityAction, bulkUpdateStatusAction, toggleTagAction } from "@/app/(app)/w/[workspaceId]/t/actions";
import { PRIORITY_META, PRIORITY_VALUES, type TaskPriorityValue } from "@/lib/task-priority";
import { plPlural } from "@/lib/pluralize";
import { hueForColor } from "@/components/ui/status-hue";
import { PRIORITY_LEVEL } from "@/components/table/priority-picker-cell";
import { memberName, type BoardTableColumn, type BoardTableTask, type ListMember } from "@/components/table/types";
import { Avatar } from "@/components/ui/avatar";
import { Chip } from "@/components/ui/chip";
import { Menu, MenuCheckboxItem, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/dropdown-menu";
import { IconChevronDown, IconClose, IconContacts, IconTag, IconTrash } from "@/components/ui/icons";
import { PriorityIcon } from "@/components/ui/priority-icon";
import { cn } from "@/lib/utils";

const BTN = "inline-flex h-7 shrink-0 items-center gap-[5px] whitespace-nowrap rounded-md px-2 text-xs font-medium text-n-700 outline-none hover:bg-n-100 active:bg-n-200 data-popup-open:bg-n-100 [&_svg]:shrink-0";

export function BulkBar({
  workspaceId,
  selected,
  statusColumns,
  members,
  allTags,
  onClear,
}: {
  workspaceId: string;
  selected: BoardTableTask[];
  statusColumns: BoardTableColumn[];
  members: ListMember[];
  allTags: { id: string; name: string; colorHex: string }[];
  onClear: () => void;
}) {
  const router = useRouter();
  const ids = selected.map((t) => t.id);
  const n = ids.length;
  const base = () => {
    const fd = new FormData();
    fd.set("workspaceId", workspaceId);
    fd.set("ids", ids.join(","));
    return fd;
  };
  const run = (fn: () => Promise<unknown>) => startTransition(async () => { await fn(); onClear(); });

  const setStatus = (statusColumnId: string) => { const fd = base(); fd.set("statusColumnId", statusColumnId); run(() => bulkUpdateStatusAction(fd)); };
  const setPriority = (priority: TaskPriorityValue) => { const fd = base(); fd.set("priority", priority); run(() => bulkSetPriorityAction(fd)); };
  const toggleAssignee = (userId: string, allHave: boolean) => { const fd = base(); fd.set("userId", userId); fd.set("mode", allHave ? "remove" : "add"); run(() => bulkAssignAction(fd)); };
  // ponytail: no bulk tag action — toggle per task (fine for a selection of dozens).
  const toggleTag = (tagId: string, allHave: boolean) =>
    run(async () => {
      for (const t of selected) {
        const has = t.tags.some((x) => x.id === tagId);
        if (has === allHave) {
          const fd = new FormData();
          fd.set("taskId", t.id);
          fd.set("tagId", tagId);
          await toggleTagAction(fd);
        }
      }
      router.refresh();
    });
  const remove = () => {
    if (!confirm(`Usunąć ${n} ${plPlural(n, "zadanie", "zadania", "zadań")}? Tego nie da się cofnąć z UI.`)) return;
    run(() => bulkDeleteTasksAction(base()));
  };
  const chevron = <IconChevronDown width={11} height={11} className="text-n-500" />;
  const sep = <span aria-hidden="true" className="h-4 w-px shrink-0 bg-border" />;

  return (
    <div
      data-ui="bulk-bar"
      role="toolbar"
      aria-label="Akcje na zaznaczonych"
      className="no-scrollbar fixed bottom-3.5 left-1/2 z-[60] flex max-w-[calc(100vw-16px)] -translate-x-1/2 items-center gap-1 overflow-x-auto whitespace-nowrap rounded-lg border border-border bg-card px-2 py-1.5 shadow-e2 max-md:bottom-[76px]"
    >
      <span className="px-1.5 text-xs font-semibold">{n} {plPlural(n, "zaznaczone", "zaznaczone", "zaznaczonych")}</span>
      {sep}
      <Menu>
        <MenuTrigger className={BTN}>Status{chevron}</MenuTrigger>
        <MenuContent side="top" align="start">
          <MenuItem onClick={() => setStatus("")} className="text-muted-foreground">— brak —</MenuItem>
          {statusColumns.map((s) => (
            <MenuItem key={s.id} onClick={() => setStatus(s.id)}>
              <Chip hue={hueForColor(s.colorHex)} dot size="md">{s.name}</Chip>
            </MenuItem>
          ))}
        </MenuContent>
      </Menu>
      <Menu>
        <MenuTrigger className={BTN}>Priorytet{chevron}</MenuTrigger>
        <MenuContent side="top" align="start" className="w-48">
          {PRIORITY_VALUES.map((p) => {
            const level = PRIORITY_LEVEL[p];
            return (
              <MenuItem key={p} onClick={() => setPriority(p)}>
                {level === null ? <span className="inline-block size-3.5 rounded-full border border-dashed border-n-400" /> : <PriorityIcon level={level} size={14} />}
                <span className={cn(level === null && "text-muted-foreground")}>{PRIORITY_META[p].label}</span>
                <span className="ml-auto pl-2 font-mono text-[10px] text-n-500">{PRIORITY_META[p].shortCode}</span>
              </MenuItem>
            );
          })}
        </MenuContent>
      </Menu>
      <Menu>
        <MenuTrigger className={BTN}><IconContacts width={12} height={12} />Przypisz</MenuTrigger>
        <MenuContent side="top" align="start" className="max-h-[50vh] overflow-y-auto">
          {members.map((m) => {
            const allHave = selected.every((t) => t.assignees.some((a) => a.id === m.id));
            return (
              <MenuCheckboxItem key={m.id} checked={allHave} closeOnClick={false} onCheckedChange={() => toggleAssignee(m.id, allHave)}>
                <Avatar name={memberName(m)} src={m.avatarUrl} size={20} />
                {memberName(m)}
              </MenuCheckboxItem>
            );
          })}
        </MenuContent>
      </Menu>
      <Menu>
        <MenuTrigger className={BTN}><IconTag width={12} height={12} />Tag</MenuTrigger>
        <MenuContent side="top" align="start" className="max-h-[50vh] overflow-y-auto">
          {allTags.length === 0 && <MenuItem disabled>Brak tagów</MenuItem>}
          {allTags.map((t) => {
            const allHave = selected.every((x) => x.tags.some((y) => y.id === t.id));
            return (
              <MenuCheckboxItem key={t.id} checked={allHave} closeOnClick={false} onCheckedChange={() => toggleTag(t.id, allHave)}>
                <Chip hue={hueForColor(t.colorHex)} size="sm">{t.name}</Chip>
              </MenuCheckboxItem>
            );
          })}
        </MenuContent>
      </Menu>
      {sep}
      <button type="button" onClick={remove} className={cn(BTN, "text-danger-text hover:bg-chip-red-bg active:bg-chip-red-bg")}>
        <IconTrash width={12} height={12} />
        Usuń
      </button>
      <button type="button" onClick={onClear} aria-label="Wyczyść zaznaczenie" className={cn(BTN, "w-7 px-0 text-muted-foreground")}>
        <IconClose width={13} height={13} />
      </button>
    </div>
  );
}
