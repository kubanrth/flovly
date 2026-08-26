"use client";

// D2 „Zadania dla Ciebie” — nagłówek + segmented (termin / tablica / priorytet),
// grupy w kontenerach 8px, wiersze 44px, „Pokaż N kolejnych…”, stopka z licznikiem.

import { startTransition, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { patchTaskAction } from "@/app/(app)/w/[workspaceId]/t/actions";
import { useAssignHotkey, type AssignMember } from "@/components/task/assign-hotkey";
import { PRIORITY_LEVEL } from "@/components/table/priority-picker-cell";
import {
  capGroups,
  formatDue,
  groupRows,
  openSummary,
  SORT_LABELS,
  type GroupMode,
  type MyTaskRow,
  type SortMode,
  type TaskGroup,
} from "@/components/my-tasks/grouping";
import { Checkbox } from "@/components/ui/checkbox";
import { StatusChip } from "@/components/ui/chip";
import { IconChevronLeft, IconFilter } from "@/components/ui/icons";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PriorityIcon } from "@/components/ui/priority-icon";
import { Segmented } from "@/components/ui/segmented";
import { hueForColor } from "@/components/ui/status-hue";
import { cn } from "@/lib/utils";

// Ile wierszy widać zanim pojawi się „Pokaż N kolejnych…” (jak w makiecie: 7 z 12).
const ROW_CAP = 7;

export interface BoardOption {
  id: string;
  name: string;
  workspaceName: string;
}

export function MyTasksView({
  rows,
  boards,
  members,
  nowIso,
  filters,
  viewedUserName,
}: {
  rows: MyTaskRow[];
  boards: BoardOption[];
  members: AssignMember[];
  /** Liczony na serwerze — inaczej SSR i klient trafiłyby w różne kubełki. */
  nowIso: string;
  filters: { search: string; boardIds: string[]; sort: SortMode };
  /** Ustawione przy `?user=` (podgląd zadań kolegi z zespołu). */
  viewedUserName: string | null;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<GroupMode>("due");
  const [showAll, setShowAll] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const assign = useAssignHotkey({ members, workspaceId: "" });

  const now = new Date(nowIso);
  const all = groupRows(rows, mode, now, filters.sort !== "updatedDesc");
  const { groups, hidden } = showAll ? { groups: all, hidden: 0 } : capGroups(all, ROW_CAP);
  const overdue = groupRows(rows, "due", now).find((g) => g.key === "overdue")?.rows.length ?? 0;
  const boardCount = new Set(rows.map((r) => r.boardId)).size;

  const markDone = (row: MyTaskRow) => {
    if (!row.doneColumnId) return;
    setChecked((prev) => new Set(prev).add(row.id));
    const fd = new FormData();
    fd.set("id", row.id);
    fd.set("statusColumnId", row.doneColumnId);
    startTransition(async () => {
      await patchTaskAction(fd);
      router.refresh();
    });
  };

  return (
    // RouteFrame owija stronę paddingiem — zdejmujemy go marginesem, żeby
    // stopka siadła na dole ekranu. ponytail: docelowo /my-tasks dopisać do
    // FULL_BLEED w components/layout/route-frame.tsx.
    <div
      data-ui="my-tasks"
      className="flex h-[calc(100dvh-48px)] min-h-0 flex-1 flex-col bg-background"
    >
      <header className="flex flex-none flex-wrap items-center gap-2.5 px-4 pt-4 md:px-8">
        {viewedUserName && (
          <Link
            href="/profile"
            className="inline-flex h-6 items-center gap-1 rounded-sm text-xs text-muted-foreground hover:text-orange-800 active:text-orange-900"
          >
            <IconChevronLeft width={12} height={12} />
            Zespół
          </Link>
        )}
        <h1 className="text-xl font-semibold tracking-[-0.3px]">
          {viewedUserName ?? "Zadania dla Ciebie"}
        </h1>
        <span className="mt-1.5 text-xs text-fg-2">{openSummary(rows.length, boardCount)}</span>
        <span className="flex-1" />
        <FiltersPopover boards={boards} filters={filters} />
        <Segmented
          aria-label="Grupowanie"
          value={mode}
          onChange={setMode}
          options={[
            { value: "due", label: "Wg terminu" },
            { value: "board", label: "Wg tablicy" },
            { value: "priority", label: "Wg priorytetu" },
          ]}
        />
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-3 md:px-8">
        <div className="max-w-[960px]">
          {rows.length === 0 ? (
            <p className="rounded-lg border border-dashed border-input-border p-4 text-center text-sm text-muted-foreground">
              {filters.search || filters.boardIds.length > 0
                ? "Nic nie pasuje do filtrów."
                : "Nikt Cię nie przypisał do żadnego otwartego zadania."}
            </p>
          ) : (
            groups.map((g) => (
              <Group key={g.key} group={g} onDone={markDone} checked={checked} rowProps={assign.rowProps} />
            ))
          )}
          {hidden > 0 && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="mt-2 inline-flex h-6 items-center rounded-sm text-xs font-medium text-orange-800 hover:text-orange-900 hover:underline active:text-orange-950"
            >
              Pokaż {hidden} kolejnych…
            </button>
          )}
        </div>
      </div>

      <footer className="flex h-8 flex-none items-center border-t border-border bg-canvas px-4 md:px-8">
        <span className="font-mono text-2xs text-fg-2">
          {rows.length} otwartych · {overdue} po terminie · sort: {SORT_LABELS[filters.sort]}
        </span>
      </footer>
      {assign.menu}
    </div>
  );
}

function Group({
  group,
  onDone,
  checked,
  rowProps,
}: {
  group: TaskGroup;
  onDone: (row: MyTaskRow) => void;
  checked: Set<string>;
  rowProps: ReturnType<typeof useAssignHotkey>["rowProps"];
}) {
  return (
    <section data-ui="my-tasks-group" className="mb-3.5">
      <div className="flex h-8 items-center gap-2">
        <h2 className={cn("eyebrow", group.tone === "danger" && "text-danger-text")}>
          {group.label} · {group.rows.length + group.hidden}
        </h2>
        <span aria-hidden className="h-px flex-1 bg-border" />
      </div>
      <ul className="overflow-hidden rounded-lg border border-border">
        {group.rows.length === 0 ? (
          <li className="flex h-11 items-center px-3 text-xs text-fg-3">Brak zadań</li>
        ) : (
          group.rows.map((row) => (
            <li key={row.id} className="border-b border-n-100 last:border-b-0">
              <Row
                row={row}
                bucket={group.bucket}
                done={checked.has(row.id)}
                onDone={() => onDone(row)}
                {...rowProps(row.id, row.assigneeIds)}
              />
            </li>
          ))
        )}
      </ul>
    </section>
  );
}

function Row({
  row,
  bucket,
  done,
  onDone,
  onMouseEnter,
  onMouseLeave,
}: {
  row: MyTaskRow;
  bucket: TaskGroup["bucket"];
  done: boolean;
  onDone: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  const level = PRIORITY_LEVEL[row.priority];
  const overdue = bucket === "overdue";
  return (
    <div
      data-ui="my-tasks-row"
      data-done={done ? "true" : "false"}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="flex h-11 items-center gap-2.5 px-3 hover:bg-row-hover data-[done=true]:bg-selected data-[done=true]:shadow-[inset_2px_0_0_var(--orange-500)]"
    >
      <Checkbox
        size="sm"
        checked={done}
        disabled={!row.doneColumnId || done}
        onCheckedChange={onDone}
        ariaLabel={`Oznacz „${row.title}” jako ukończone`}
      />
      <span className="shrink-0 font-mono text-xs text-fg-2">{row.displayId}</span>
      <Link
        href={`/w/${row.workspaceId}/t/${row.id}?from=${encodeURIComponent("/my-tasks")}`}
        className={cn(
          "min-w-0 flex-1 truncate rounded-sm text-sm font-medium text-foreground hover:text-orange-800 active:text-orange-900",
          done && "text-fg-3 line-through",
        )}
      >
        {row.title}
      </Link>
      {level !== null && <PriorityIcon level={level} size={13} className="shrink-0" />}
      {row.statusName && (
        <StatusChip label={row.statusName} hue={hueForColor(row.statusColorHex)} />
      )}
      <span className="hidden shrink-0 text-xs text-fg-3 sm:inline">{row.boardName}</span>
      <span
        className={cn(
          "w-16 shrink-0 text-right text-xs",
          overdue ? "font-semibold text-danger-text" : "text-fg-2",
        )}
      >
        {row.stopAt ? formatDue(row.stopAt, bucket ?? "later") : ""}
      </span>
    </div>
  );
}

// Szukaj / tablice / sortowanie — makieta D2 nie ma paska filtrów, więc
// mieszkają w jednym popoverze obok segmented.
function FiltersPopover({
  boards,
  filters,
}: {
  boards: BoardOption[];
  filters: { search: string; boardIds: string[]; sort: SortMode };
}) {
  const router = useRouter();
  const [search, setSearch] = useState(filters.search);
  const active = (filters.search ? 1 : 0) + (filters.boardIds.length > 0 ? 1 : 0) + (filters.sort !== "updatedDesc" ? 1 : 0);

  const push = (next: { search?: string; boardIds?: string[]; sort?: SortMode }) => {
    const p = new URLSearchParams();
    const s = next.search ?? filters.search;
    const b = next.boardIds ?? filters.boardIds;
    const sort = next.sort ?? filters.sort;
    if (s.trim()) p.set("search", s.trim());
    if (b.length > 0) p.set("boardIds", b.join(","));
    if (sort !== "updatedDesc") p.set("sort", sort);
    router.replace(p.size > 0 ? `?${p.toString()}` : "?");
  };

  const toggleBoard = (id: string) =>
    push({ boardIds: filters.boardIds.includes(id) ? filters.boardIds.filter((x) => x !== id) : [...filters.boardIds, id] });

  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          "inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 text-xs font-medium text-n-700 hover:bg-n-100 active:bg-n-200",
          active > 0 && "border-orange-500 text-orange-800",
        )}
      >
        <IconFilter width={14} height={14} />
        Filtry{active > 0 ? ` · ${active}` : ""}
      </PopoverTrigger>
      <PopoverContent align="end" className="flex w-[280px] flex-col gap-2.5">
        <Input
          size="sm"
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") push({ search });
          }}
          onBlur={() => push({ search })}
          placeholder="Szukaj po tytule…"
          aria-label="Szukaj po tytule"
        />
        <label className="flex flex-col gap-1">
          <span className="eyebrow">Sortowanie</span>
          <select
            value={filters.sort}
            onChange={(e) => push({ sort: e.currentTarget.value as SortMode })}
            className="h-7 rounded-sm border border-input-border bg-card px-2 text-xs text-foreground hover:border-input-border-hover focus:border-orange-500"
          >
            {(Object.keys(SORT_LABELS) as SortMode[]).map((s) => (
              <option key={s} value={s}>
                {SORT_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        {boards.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="eyebrow">Tablica</span>
            <div className="flex max-h-52 flex-col overflow-y-auto">
              {boards.map((b) => (
                <label
                  key={b.id}
                  className="flex h-8 cursor-pointer items-center gap-2 rounded-md px-1.5 text-sm hover:bg-n-100"
                >
                  <Checkbox
                    size="sm"
                    checked={filters.boardIds.includes(b.id)}
                    onCheckedChange={() => toggleBoard(b.id)}
                    ariaLabel={b.name}
                  />
                  <span className="min-w-0 flex-1 truncate">{b.name}</span>
                  <span className="shrink-0 text-2xs text-fg-3">{b.workspaceName}</span>
                </label>
              ))}
            </div>
          </div>
        )}
        {active > 0 && (
          <button
            type="button"
            onClick={() => router.replace("?")}
            className="inline-flex h-7 items-center justify-center rounded-md border border-border bg-card text-xs font-medium text-n-700 hover:bg-n-100 active:bg-n-200"
          >
            Wyczyść filtry
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
