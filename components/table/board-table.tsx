"use client";

import { startTransition, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnOrderState,
  type ColumnPinningState,
  type ColumnSizingState,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { Plus, Search, X } from "lucide-react";
import { TaskActivityHints } from "@/components/task/task-activity-hints";
import {
  PRIORITY_META,
  PRIORITY_VALUES,
  PRIORITY_WEIGHT,
  type TaskPriorityValue,
} from "@/lib/task-priority";
import { PriorityPickerCell } from "@/components/table/priority-picker-cell";
import {
  createTableColumnAction,
  saveTableColumnPrefsAction,
} from "@/app/(app)/w/[workspaceId]/b/[boardId]/actions";
import {
  bulkAssignAction,
  bulkDeleteTasksAction,
  bulkSetPriorityAction,
  bulkUpdateStatusAction,
  createTaskAction,
} from "@/app/(app)/w/[workspaceId]/t/actions";
import { patchTaskAction } from "@/app/(app)/w/[workspaceId]/t/actions";
import { useWorkspaceRealtime } from "@/hooks/use-workspace-realtime";
import { taskPl } from "@/lib/pluralize";
import { ColumnSettings, type ColumnDef } from "@/components/table/column-settings";
import {
  AssigneePickerCell,
  TagPickerCell,
  type PickerTag,
} from "@/components/table/cell-pickers";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { FieldCell } from "@/components/table/field-cells";
import { TableHeaderCell } from "@/components/table/header-cell";
import { FieldOptionsEditor, FieldTypePicker } from "@/components/table/field-config";
import { StatusPicker } from "@/components/table/status-picker";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AttachmentCell,
  type AttachmentCellItem,
} from "@/components/table/attachment-cell";
import { parseFieldOptions, type FieldOptions, type FieldType } from "@/lib/table-fields";
import {
  TableFiltersToolbar,
  type ToolbarColumnRef,
} from "@/components/table/table-filters-toolbar";
import { MobileFiltersDrawer } from "@/components/table/mobile-filters-drawer";
import {
  compareValues,
  matchesFilter,
  type TableFilter,
  type TableSort,
} from "@/lib/table-filters";
import { saveTableFiltersAction } from "@/app/(app)/w/[workspaceId]/b/[boardId]/actions";
import { GROUP_PRESETS, bucketForPreset } from "@/lib/group-presets";
import {
  useAssignHotkey,
  type AssignMember,
} from "@/components/task/assign-hotkey";

export interface BoardTableTask {
  id: string;
  // F12-K57 / F-postfix: ludzki, sekwencyjny ID per-workspace (1, 2, 3...).
  // Renderowany w kolumnie "ID" jako `#123`. 0 = legacy task sprzed
  // backfillu — user dostaje sygnał ("#0") że trzeba odpalić SQL.
  displayId: number;
  title: string;
  statusColumnId: string | null;
  // F12-K75: priorytet zadania. NONE = bez badge'a w kolumnie Priorytet.
  priority: TaskPriorityValue;
  startAt: string | null;
  stopAt: string | null;
  // Needed by "Data dodania" preset grouping; server default(now) guarantees non-null.
  createdAt: string;
  assignees: {
    id: string;
    name: string | null;
    email: string;
    avatarUrl: string | null;
  }[];
  tags: { id: string; name: string; colorHex: string }[];
  // User-defined column values, keyed by custom column id.
  customValues: Record<string, string>;
  attachments: AttachmentCellItem[];
  // Lightweight indicators so the row hints at "there's more inside" without
  // making the user open the modal to find out.
  hasDescription: boolean;
  commentCount: number;
  subtaskCount: number;
  subtaskDoneCount: number;
  linkedCount: number;
}

export interface BoardTableColumn {
  id: string;
  name: string;
  colorHex: string;
}

export interface CustomTableColumn {
  id: string;
  name: string;
  type: FieldType;
  // Type-specific config (select options, number format, etc.) — parseFieldOptions tolerates anything.
  options: unknown;
}

const col = createColumnHelper<BoardTableTask>();

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Re-order these to change the factory-default layout for brand-new boards.
const DEFAULT_COLUMN_ORDER: string[] = [
  "statusColumnId",
  "priority",
  "displayId",
  "title",
  "assignees",
  "tags",
  "startAt",
  "stopAt",
  "attachments",
];

// All columns are hideable; brand-new boards auto-create the built-ins.
const COLUMN_DEFS: ColumnDef[] = [
  { id: "statusColumnId", label: "Status" },
  { id: "priority", label: "Priorytet" },
  { id: "displayId", label: "ID" },
  { id: "title", label: "Tytuł" },
  { id: "assignees", label: "Osoby" },
  { id: "tags", label: "Tagi" },
  { id: "startAt", label: "Start" },
  { id: "stopAt", label: "Koniec" },
  { id: "attachments", label: "Załączniki" },
];

export function BoardTable({
  workspaceId,
  boardId,
  statusColumns,
  tasks,
  canEdit,
  canManagePrefs,
  initialColumnOrder,
  initialHiddenColumns,
  initialFilters,
  initialSort,
  initialGroupBy,
  initialWidths,
  initialPinned,
  customColumns,
  members,
  allTags,
}: {
  workspaceId: string;
  boardId: string;
  statusColumns: BoardTableColumn[];
  tasks: BoardTableTask[];
  canEdit: boolean;
  canManagePrefs: boolean;
  initialColumnOrder?: string[];
  initialHiddenColumns?: string[];
  initialFilters?: TableFilter[];
  initialSort?: TableSort | null;
  initialGroupBy?: string | null;
  initialWidths?: Record<string, number>;
  // `undefined` = legacy board (falls back to "first column auto-frozen"); `[]` = explicit unpin.
  initialPinned?: string[];
  customColumns: CustomTableColumn[];
  members: AssignMember[];
  allTags: PickerTag[];
}) {
  const assign = useAssignHotkey({ members, workspaceId });
  const [sorting, setSorting] = useState<SortingState>([]);
  const customIds = useMemo(
    () => customColumns.map((c) => `custom:${c.id}`),
    [customColumns],
  );
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>(() => {
    const knownIds = new Set([...DEFAULT_COLUMN_ORDER, ...customIds]);
    // Server order wins; unknown ids stripped, new built-ins/custom appended.
    if (initialColumnOrder && initialColumnOrder.length > 0) {
      const retained = initialColumnOrder.filter((id) => knownIds.has(id));
      const retainedSet = new Set(retained);
      return [
        ...retained,
        ...DEFAULT_COLUMN_ORDER.filter((id) => !retainedSet.has(id)),
        ...customIds.filter((id) => !retainedSet.has(id)),
      ];
    }
    return [...DEFAULT_COLUMN_ORDER, ...customIds];
  });
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    const vis: VisibilityState = {};
    for (const id of DEFAULT_COLUMN_ORDER) {
      vis[id] = !(initialHiddenColumns ?? []).includes(id);
    }
    for (const id of customIds) {
      vis[id] = !(initialHiddenColumns ?? []).includes(id);
    }
    return vis;
  });
  useWorkspaceRealtime(workspaceId);

  // Shift-click range selection done manually — TanStack doesn't ship it out of the box.
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const lastClickedRowRef = useRef<string | null>(null);
  const extendSelection = (toId: string) => {
    if (!lastClickedRowRef.current) return;
    const fromId = lastClickedRowRef.current;
    const ids = filteredSorted.map((t) => t.id);
    const fromIdx = ids.indexOf(fromId);
    const toIdx = ids.indexOf(toId);
    if (fromIdx === -1 || toIdx === -1) return;
    const [a, b] = fromIdx < toIdx ? [fromIdx, toIdx] : [toIdx, fromIdx];
    setRowSelection((prev) => {
      const next = { ...prev };
      for (let i = a; i <= b; i++) next[ids[i]] = true;
      return next;
    });
  };

  // Persists per-column widths to server when the user releases the drag handle.
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(
    () => initialWidths ?? {},
  );
  // Skip first-render no-op write — initial state already matches server.
  const sizingDirty = useRef(false);
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!canManagePrefs) return;
    if (!sizingDirty.current) {
      sizingDirty.current = true;
      return;
    }
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      const fd = new FormData();
      fd.set("workspaceId", workspaceId);
      fd.set("boardId", boardId);
      fd.set("config", JSON.stringify({ widths: columnSizing }));
      startTransition(() => {
        saveTableColumnPrefsAction(fd);
      });
    }, 800);
    return () => {
      // Flush pending save on unmount (route change) — user expects width to persist.
      if (persistTimer.current) {
        clearTimeout(persistTimer.current);
        const fd = new FormData();
        fd.set("workspaceId", workspaceId);
        fd.set("boardId", boardId);
        fd.set("config", JSON.stringify({ widths: columnSizing }));
        startTransition(() => {
          saveTableColumnPrefsAction(fd);
        });
      }
    };
  }, [columnSizing, workspaceId, boardId, canManagePrefs]);

  // Legacy boards (undefined `pinned`) get historical "first column auto-frozen"; empty array = user unpinned all.
  const [columnPinning, setColumnPinning] = useState<ColumnPinningState>(() => {
    if (initialPinned !== undefined) return { left: initialPinned, right: [] };
    const hidden = new Set(initialHiddenColumns ?? []);
    const firstVisible = (initialColumnOrder ?? DEFAULT_COLUMN_ORDER).find(
      (id) => !hidden.has(id),
    );
    return { left: firstVisible ? [firstVisible] : [], right: [] };
  });
  const pinningDirty = useRef(false);
  useEffect(() => {
    if (!canManagePrefs) return;
    if (!pinningDirty.current) {
      pinningDirty.current = true;
      return;
    }
    const fd = new FormData();
    fd.set("workspaceId", workspaceId);
    fd.set("boardId", boardId);
    fd.set("config", JSON.stringify({ pinned: columnPinning.left ?? [] }));
    startTransition(() => {
      saveTableColumnPrefsAction(fd);
    });
  }, [columnPinning, workspaceId, boardId, canManagePrefs]);

  // Applied client-side over `tasks` so realtime patches keep working.
  const [filters, setFilters] = useState<TableFilter[]>(initialFilters ?? []);
  const [tableSort, setTableSort] = useState<TableSort | null>(initialSort ?? null);
  const [groupBy, setGroupBy] = useState<string | null>(initialGroupBy ?? null);

  // Cmd+F opens client-only refinement search over title + every custom cell. Never persisted.
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Tracks active cell as [rowIdx, colIdx]; Enter focuses the first focusable child for immediate typing.
  const [activeCell, setActiveCell] = useState<{ row: number; col: number } | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setSearchOpen(true);
        // Focus on next tick — input must mount first.
        setTimeout(() => searchInputRef.current?.focus(), 0);
      } else if (e.key === "Escape" && searchOpen) {
        setSearchOpen(false);
        setSearchQuery("");
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [searchOpen]);

  // Used by toolbar AND header-cell context menu actions to keep server in sync.
  const persistFilters = (next: {
    filters: TableFilter[];
    sort: TableSort | null;
    groupBy: string | null;
  }) => {
    if (!canManagePrefs) return;
    const fd = new FormData();
    fd.set("workspaceId", workspaceId);
    fd.set("boardId", boardId);
    fd.set(
      "payload",
      JSON.stringify({ filters: next.filters, sort: next.sort, groupBy: next.groupBy }),
    );
    startTransition(() => saveTableFiltersAction(fd));
  };

  // Used when the column menu hides a column without going through ColumnSettings.
  const persistPrefs = (patch: {
    columnOrder?: string[];
    hidden?: string[];
    widths?: Record<string, number>;
  }) => {
    if (!canManagePrefs) return;
    const fd = new FormData();
    fd.set("workspaceId", workspaceId);
    fd.set("boardId", boardId);
    fd.set("config", JSON.stringify(patch));
    startTransition(() => saveTableColumnPrefsAction(fd));
  };

  // Filter → sort pipeline; grouping happens at render time so each group keeps the same sort.
  // useDeferredValue keeps search input responsive on 500-row tables.
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const filteredSorted = useMemo(() => {
    const valueOf = (t: BoardTableTask, columnId: string): string => {
      if (columnId === "title") return t.title;
      if (columnId === "statusColumnId") return t.statusColumnId ?? "";
      if (columnId === "startAt") return t.startAt ?? "";
      if (columnId === "stopAt") return t.stopAt ?? "";
      return t.customValues[columnId] ?? "";
    };
    let rows = tasks;
    if (filters.length > 0) {
      rows = rows.filter((t) => filters.every((f) => matchesFilter(f, valueOf(t, f.columnId))));
    }
    if (deferredSearchQuery.trim()) {
      const q = deferredSearchQuery.trim().toLowerCase();
      rows = rows.filter((t) => {
        if (t.title.toLowerCase().includes(q)) return true;
        for (const v of Object.values(t.customValues)) {
          if (v && v.toLowerCase().includes(q)) return true;
        }
        return false;
      });
    }
    if (tableSort) {
      const dirMul = tableSort.dir === "asc" ? 1 : -1;
      rows = [...rows].sort(
        (a, b) =>
          dirMul *
          compareValues(valueOf(a, tableSort.columnId), valueOf(b, tableSort.columnId), tableSort.kind),
      );
    }
    return rows;
  }, [tasks, filters, tableSort, deferredSearchQuery]);

  const columns = useMemo(
    () => [
      col.accessor("statusColumnId", {
        header: "Status",
        size: 160,
        minSize: 80,
        cell: (info) => {
          const value = info.getValue();
          const current = value ? statusColumns.find((c) => c.id === value) ?? null : null;
          return (
            <StatusPicker
              taskId={info.row.original.id}
              workspaceId={workspaceId}
              boardId={boardId}
              current={current}
              options={statusColumns}
              canEdit={canEdit}
              canManageBoard={canManagePrefs}
            />
          );
        },
        sortingFn: (a, b) => {
          const ao = statusColumns.findIndex((c) => c.id === a.original.statusColumnId);
          const bo = statusColumns.findIndex((c) => c.id === b.original.statusColumnId);
          return (ao === -1 ? 999 : ao) - (bo === -1 ? 999 : bo);
        },
      }),
      // F12-K75: kolumna priorytetu — sortowanie po PRIORITY_WEIGHT (URGENT
      // najwyżej, NONE najniżej). Inline picker przez popover.
      col.accessor("priority", {
        header: "Priorytet",
        size: 130,
        minSize: 90,
        cell: (info) => (
          <PriorityPickerCell
            taskId={info.row.original.id}
            current={info.getValue()}
            canEdit={canEdit}
          />
        ),
        sortingFn: (a, b) =>
          PRIORITY_WEIGHT[a.original.priority] -
          PRIORITY_WEIGHT[b.original.priority],
      }),
      // F-postfix: ludzki ID per-workspace. `#123` linkuje do detail page —
      // task table to często "lista do triażu", więc szybki klik w ID otwiera
      // szczegóły bez wchodzenia w tytuł. Sortuje numerycznie (nie po stringu).
      // displayId==0 = legacy task sprzed backfillu, render "#0" jako sygnał.
      col.accessor("displayId", {
        header: "ID",
        size: 70,
        minSize: 50,
        cell: (info) => (
          <Link
            href={`/w/${workspaceId}/t/${info.row.original.id}`}
            className="font-mono text-[11px] tracking-tight text-muted-foreground transition-colors hover:text-primary"
          >
            #{info.getValue()}
          </Link>
        ),
        sortingFn: (a, b) => a.original.displayId - b.original.displayId,
      }),
      col.accessor("title", {
        header: "Tytuł",
        size: 280,
        minSize: 120,
        cell: (info) => {
          const row = info.row.original;
          return (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 min-w-0">
                <Link
                  href={`/w/${workspaceId}/t/${row.id}`}
                  lang="pl"
                  // break-normal + hyphens-auto: zamiast łamać słowo w środku znaku
                  // (browser czasem chował "w" z "opisów" gdy cell był na granicy
                  // szerokości), wyraz wraps w całości albo dostaje miękki łącznik
                  // — co w pl wymaga lang="pl". text-pretty + pr-0.5 dorzucają
                  // budżet na ostatni glif (negatywne tracking + sub-pixel
                  // rounding obcinały ogonek 'ą' / 'ę' / 'ó').
                  className="block min-w-0 truncate whitespace-nowrap pr-0.5 font-display text-[13.5px] font-semibold leading-snug tracking-[-0.005em] text-foreground transition-colors hover:text-primary"
                >
                  {info.getValue()}
                </Link>
              </div>
              <TaskActivityHints
                hasDescription={row.hasDescription}
                commentCount={row.commentCount}
                subtaskCount={row.subtaskCount}
                subtaskDoneCount={row.subtaskDoneCount}
                linkedCount={row.linkedCount}
              />
            </div>
          );
        },
      }),
      col.accessor("assignees", {
        header: "Osoby",
        size: 160,
        minSize: 80,
        enableSorting: false,
        cell: (info) => (
          <AssigneePickerCell
            taskId={info.row.original.id}
            current={info.getValue()}
            members={members}
            canEdit={canEdit}
          />
        ),
      }),
      col.accessor("tags", {
        header: "Tagi",
        size: 220,
        minSize: 100,
        enableSorting: false,
        cell: (info) => (
          <TagPickerCell
            taskId={info.row.original.id}
            current={info.getValue()}
            allTags={allTags}
            canEdit={canEdit}
          />
        ),
      }),
      col.accessor("startAt", {
        header: "Start",
        size: 180,
        minSize: 110,
        cell: (info) => (
          <DateCell
            taskId={info.row.original.id}
            field="startAt"
            value={info.getValue()}
            disabled={!canEdit}
          />
        ),
      }),
      col.accessor("stopAt", {
        header: "Koniec",
        size: 180,
        minSize: 110,
        cell: (info) => (
          <DateCell
            taskId={info.row.original.id}
            field="stopAt"
            value={info.getValue()}
            disabled={!canEdit}
          />
        ),
      }),
      col.accessor("attachments", {
        id: "attachments",
        header: "Załączniki",
        size: 140,
        minSize: 100,
        sortingFn: (a, b) =>
          a.original.attachments.length - b.original.attachments.length,
        cell: (info) => (
          <AttachmentCell
            taskId={info.row.original.id}
            attachments={info.row.original.attachments}
            canEdit={canEdit}
          />
        ),
      }),
      // `custom:` id prefix keeps order + visibility state distinct from built-ins.
      ...customColumns.map((c) =>
        col.display({
          id: `custom:${c.id}`,
          header: c.name,
          size: defaultSizeForType(c.type),
          minSize: 80,
          cell: ({ row }) => (
            <FieldCell
              taskId={row.original.id}
              columnId={c.id}
              type={c.type}
              raw={row.original.customValues[c.id] ?? ""}
              options={parseFieldOptions(c.options) as FieldOptions}
              disabled={!canEdit}
            />
          ),
        }),
      ),
    ],
    [statusColumns, canEdit, workspaceId, boardId, canManagePrefs, customColumns, members, allTags],
  );

  const table = useReactTable({
    data: filteredSorted,
    columns,
    state: { sorting, columnOrder, columnVisibility, columnSizing, columnPinning, rowSelection },
    onSortingChange: setSorting,
    onColumnOrderChange: setColumnOrder,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnSizingChange: setColumnSizing,
    onColumnPinningChange: setColumnPinning,
    onRowSelectionChange: setRowSelection,
    getRowId: (row) => row.id,
    enableColumnResizing: true,
    enableColumnPinning: true,
    columnResizeMode: "onChange",
    enableRowSelection: canEdit,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const selectedTaskIds = Object.keys(rowSelection).filter((id) => rowSelection[id]);

  const hiddenIds = Object.entries(columnVisibility)
    .filter(([, visible]) => !visible)
    .map(([id]) => id);

  const settingsColumns: ColumnDef[] = [
    ...COLUMN_DEFS,
    ...customColumns.map((c) => ({
      id: `custom:${c.id}`,
      label: c.name,
      custom: true,
      fieldType: c.type,
      fieldOptions: parseFieldOptions(c.options),
    })),
  ];

  // Built-ins use BUILTIN_* kinds so the operators table gives them sensible defaults.
  const toolbarColumns: ToolbarColumnRef[] = [
    { id: "title", label: "Tytuł", kind: "BUILTIN_TITLE" },
    {
      id: "statusColumnId",
      label: "Status",
      kind: "BUILTIN_STATUS",
      statusOptions: statusColumns.map((s) => ({ id: s.id, label: s.name, color: s.colorHex })),
    },
    { id: "startAt", label: "Start", kind: "BUILTIN_DATE" },
    { id: "stopAt", label: "Koniec", kind: "BUILTIN_DATE" },
    ...customColumns.map((c) => ({
      id: c.id,
      label: c.name,
      kind: c.type,
      fieldOptions: parseFieldOptions(c.options),
    })),
  ];

  // Returns ordered buckets so the rendering side can iterate without re-sorting.
  const groupedRows: { key: string; label: string; color?: string; rows: typeof filteredSorted }[] = (() => {
    if (!groupBy) return [{ key: "_all", label: "", rows: filteredSorted }];

    // Preset buckets sorted by descriptor `order` for stable ordering regardless of row sort.
    if (groupBy.startsWith("preset:")) {
      type PresetEntry = {
        rows: typeof filteredSorted;
        label: string;
        color?: string;
        order: number;
      };
      const presetBuckets = new Map<string, PresetEntry>();
      for (const t of filteredSorted) {
        const desc = bucketForPreset(groupBy, t);
        const existing = presetBuckets.get(desc.key);
        if (existing) {
          existing.rows.push(t);
        } else {
          presetBuckets.set(desc.key, {
            rows: [t],
            label: desc.label,
            color: desc.color,
            order: desc.order,
          });
        }
      }
      return Array.from(presetBuckets.entries())
        .map(([key, v]) => ({ key, label: v.label, color: v.color, rows: v.rows, order: v.order }))
        .sort((a, b) => a.order - b.order)
        .map(({ order: _order, ...rest }) => rest);
    }

    const buckets = new Map<string, typeof filteredSorted>();
    for (const t of filteredSorted) {
      const raw =
        groupBy === "statusColumnId"
          ? t.statusColumnId ?? ""
          : groupBy === "title"
            ? t.title
            : groupBy === "startAt"
              ? t.startAt ?? ""
              : groupBy === "stopAt"
                ? t.stopAt ?? ""
                : t.customValues[groupBy] ?? "";
      const k = raw || "_empty";
      if (!buckets.has(k)) buckets.set(k, []);
      buckets.get(k)!.push(t);
    }

    const labelFor = (k: string): { label: string; color?: string } => {
      if (k === "_empty") return { label: "— brak —" };
      if (groupBy === "statusColumnId") {
        const s = statusColumns.find((x) => x.id === k);
        return { label: s?.name ?? "—", color: s?.colorHex };
      }
      const customCol = customColumns.find((c) => c.id === groupBy);
      if (customCol?.type === "SINGLE_SELECT") {
        const opts = parseFieldOptions(customCol.options).selectOptions ?? [];
        const opt = opts.find((o) => o.value === k);
        return { label: opt?.value ?? k, color: opt?.color };
      }
      if (customCol?.type === "CHECKBOX") {
        return { label: k === "true" || k === "1" ? "Zaznaczone" : "Niezaznaczone" };
      }
      if (customCol?.type === "RATING") {
        return { label: `${k} ★` };
      }
      return { label: k };
    };

    return Array.from(buckets.entries()).map(([key, rows]) => {
      const { label, color } = labelFor(key);
      return { key, label, color, rows };
    });
  })();

  return (
    <div className="flex flex-col gap-4">
      {/* Cmd+F search bar — pojawia się nad toolbarem, nie zajmuje miejsca gdy zamknięty. */}
      {searchOpen && (
        <div className="flex items-center gap-2 rounded-xl border border-primary/40 bg-popover/95 px-3 py-2 shadow-[0_8px_24px_-8px_rgba(122,51,236,0.25)] backdrop-blur-sm">
          <Search size={14} className="text-muted-foreground" />
          <input
            ref={searchInputRef}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setSearchQuery("");
                setSearchOpen(false);
              }
            }}
            placeholder="Szukaj w tabeli… (Esc aby zamknąć)"
            className="flex-1 bg-transparent text-[0.88rem] outline-none placeholder:text-muted-foreground/60"
          />
          <span className="font-mono text-[0.62rem] uppercase tracking-[0.1em] text-muted-foreground">
            {filteredSorted.length} {taskPl(filteredSorted.length)}
          </span>
          <button
            type="button"
            onClick={() => {
              setSearchQuery("");
              setSearchOpen(false);
            }}
            aria-label="Zamknij wyszukiwarkę"
            className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X size={12} />
          </button>
        </div>
      )}

      {/* v4 .tbl-controls — pasek nad tabelą: filtr/sort/grupuj z lewej, kolumny z prawej.
          Mobile v4 (B11 — Filter drawer): inline toolbar collapses into a bottom-sheet
          on max-md, triggered by a "Filtry" pill. Desktop unchanged. */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="hidden md:block">
          <TableFiltersToolbar
            workspaceId={workspaceId}
            boardId={boardId}
            columns={toolbarColumns}
            groupPresets={GROUP_PRESETS.map((p) => ({ id: p.id, label: p.label }))}
            filters={filters}
            sort={tableSort}
            groupBy={groupBy}
            canEdit={canManagePrefs}
            onChange={(next) => {
              setFilters(next.filters);
              setTableSort(next.sort);
              setGroupBy(next.groupBy);
            }}
          />
        </div>
        <div className="md:hidden">
          <MobileFiltersDrawer
            workspaceId={workspaceId}
            boardId={boardId}
            columns={toolbarColumns}
            groupPresets={GROUP_PRESETS.map((p) => ({ id: p.id, label: p.label }))}
            filters={filters}
            sort={tableSort}
            groupBy={groupBy}
            canEdit={canManagePrefs}
            onChange={(next) => {
              setFilters(next.filters);
              setTableSort(next.sort);
              setGroupBy(next.groupBy);
            }}
          />
        </div>
        {canManagePrefs && (
          <ColumnSettings
            workspaceId={workspaceId}
            boardId={boardId}
            columns={settingsColumns}
            columnOrder={columnOrder}
            hidden={hiddenIds}
            onLocalChange={(next) => {
              setColumnOrder(next.order);
              const allIds = [
                ...DEFAULT_COLUMN_ORDER,
                ...customColumns.map((c) => `custom:${c.id}`),
              ];
              const vis: VisibilityState = {};
              for (const id of allIds) {
                vis[id] = !next.hidden.includes(id);
              }
              setColumnVisibility(vis);
            }}
          />
        )}
      </div>

      {/* v4 spec (linie 39): rounded-22px, glass surface bg, brand-tinted shadow
          `0 30px 70px -30px rgba(122,51,236,.4)` + delikatny inset highlight.
          Border: rgba(255,255,255,.06) w dark, n-200 w light. */}
      <div className="relative overflow-hidden rounded-[22px] border border-border/60 bg-card/95 shadow-[0_30px_70px_-30px_rgba(122,51,236,0.4),inset_0_1px_0_rgba(255,255,255,0.04)] dark:bg-white/[0.02] dark:backdrop-blur-xl">
        <div className="overflow-x-auto">
          <table
            ref={tableRef}
            className="text-[0.86rem]"
            // F12-K90 (resize fix): width = sumarycznie kolumn (TanStack
            // getTotalSize). Z `max-content` Safari/Chrome ignorowały
            // dynamiczne <th width> i resize handle nie zmieniał wizualnej
            // szerokości mimo że state się aktualizował.
            style={{ tableLayout: "fixed", width: table.getTotalSize(), minWidth: "100%" }}
            onKeyDown={(e) => {
              if (!activeCell) return;
              // Only intercept when a CELL (td) is focus target — otherwise inputs in cells own their keystrokes.
              const target = e.target as HTMLElement;
              const onCellTd = target.tagName === "TD" || target.dataset.cell === "1";
              if (!onCellTd) return;
              const visibleRows = filteredSorted;
              const colIds = table.getVisibleLeafColumns().map((c) => c.id);
              const moveTo = (r: number, c: number) => {
                const clampedR = Math.max(0, Math.min(visibleRows.length - 1, r));
                const clampedC = Math.max(0, Math.min(colIds.length - 1, c));
                setActiveCell({ row: clampedR, col: clampedC });
                const sel = `td[data-cell="1"][data-row="${clampedR}"][data-col="${clampedC}"]`;
                const next = tableRef.current?.querySelector<HTMLTableCellElement>(sel);
                next?.focus();
              };
              if (e.key === "ArrowDown") {
                e.preventDefault();
                moveTo(activeCell.row + 1, activeCell.col);
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                moveTo(activeCell.row - 1, activeCell.col);
              } else if (e.key === "ArrowLeft") {
                e.preventDefault();
                moveTo(activeCell.row, activeCell.col - 1);
              } else if (e.key === "ArrowRight" || (e.key === "Tab" && !e.shiftKey)) {
                e.preventDefault();
                const nextCol = activeCell.col + 1;
                if (nextCol >= colIds.length) {
                  moveTo(activeCell.row + 1, 0);
                } else {
                  moveTo(activeCell.row, nextCol);
                }
              } else if (e.key === "Tab" && e.shiftKey) {
                e.preventDefault();
                const prevCol = activeCell.col - 1;
                if (prevCol < 0) {
                  moveTo(activeCell.row - 1, colIds.length - 1);
                } else {
                  moveTo(activeCell.row, prevCol);
                }
              } else if (e.key === "Enter" || e.key === "F2") {
                // Focus first interactive child so user can start typing immediately.
                e.preventDefault();
                const editable = target.querySelector<HTMLElement>(
                  'input, textarea, select, button:not([aria-label="Konfiguruj kolumnę"])',
                );
                editable?.focus();
              }
            }}
          >
            <thead>
              {table.getHeaderGroups().map((hg) => {
                // Render pinned headers first so DOM order matches visual order.
                const leftHeaders = hg.headers.filter(
                  (h) => h.column.getIsPinned() === "left",
                );
                const centerHeaders = hg.headers.filter(
                  (h) => !h.column.getIsPinned(),
                );
                const checkboxOffset = canEdit ? 44 : 0;
                return (
                  // v4 spec (linia 40): glass bg + backdrop-blur(30px) saturate(160%),
                  // border-bottom hairline. Higher saturate niż reszta sticky elementów
                  // — header ma się czuć jak osobna warstwa "frosted glass".
                  <tr key={hg.id} className="border-b border-border/60 bg-card/95 shadow-[0_1px_0_0_var(--border)] dark:bg-card/95">
                    {canEdit && (
                      // Sticky pinning disabled on mobile (max-md:!static) — couldn't scroll past pinned columns.
                      <th
                        className="sticky left-0 top-0 z-30 h-11 w-11 bg-card/95 px-3 shadow-[1px_0_0_0_var(--border)] dark:bg-card/95 max-md:!static max-md:!shadow-none"
                        // F12-K76: hint o shift+click range select — najczęstszy
                        // bulk-action UX, ale wymaga discovery.
                        title="Klik = zaznacz wszystkie. Klik + Shift na innym wierszu = zakres."
                      >
                        {(() => {
                          const allChecked =
                            table.getRowModel().rows.length > 0 &&
                            table.getRowModel().rows.every((r) => rowSelection[r.id]);
                          const someChecked = table
                            .getRowModel()
                            .rows.some((r) => rowSelection[r.id]);
                          return (
                            <Checkbox
                              ariaLabel="Zaznacz wszystkie wiersze (shift+click na innym = zakres)"
                              checked={allChecked}
                              indeterminate={!allChecked && someChecked}
                              onChange={(e) => {
                                if (e.currentTarget.checked) {
                                  const next: RowSelectionState = {};
                                  for (const r of table.getRowModel().rows) next[r.id] = true;
                                  setRowSelection(next);
                                } else {
                                  setRowSelection({});
                                }
                              }}
                            />
                          );
                        })()}
                      </th>
                    )}
                    {[...leftHeaders, ...centerHeaders].map((header) => {
                      const canResize = header.column.getCanResize();
                      const isResizing = header.column.getIsResizing();
                      const colId = header.column.id;
                      const isCustom = colId.startsWith("custom:");
                      const customCol = isCustom
                        ? customColumns.find((c) => `custom:${c.id}` === colId)
                        : null;
                      const headerLabel =
                        typeof header.column.columnDef.header === "string"
                          ? header.column.columnDef.header
                          : colId;
                      const sortDir =
                        tableSort?.columnId ===
                        (isCustom ? colId.replace(/^custom:/, "") : colId)
                          ? tableSort.dir
                          : false;
                      const isPinned = header.column.getIsPinned() === "left";
                      const pinnedLeft = isPinned
                        ? checkboxOffset + header.column.getStart("left")
                        : null;
                      return (
                        <th
                          key={header.id}
                          // v4 spec (linia 40): font-size 11px, font-weight 700,
                          // tracking 0.03em, uppercase, color faint.
                          // Active sort column → brand-light tint + arrow (handled
                          // w TableHeaderCell, ten div tylko hostuje).
                          className={`group/th relative sticky top-0 h-11 px-[18px] text-left font-mono text-[0.69rem] font-bold uppercase tracking-[0.03em] max-md:px-3 ${
                            sortDir
                              ? "text-brand-300 dark:text-brand-300"
                              : "text-muted-foreground/80"
                          } ${
                            isPinned
                              ? "z-20 bg-card/95 shadow-[1px_0_0_0_var(--border)] dark:bg-card/95 max-md:!static max-md:!bg-transparent max-md:!shadow-none"
                              : "bg-transparent"
                          }`}
                          style={{
                            width: header.getSize(),
                            ...(isPinned && pinnedLeft !== null ? { left: `${pinnedLeft}px` } : {}),
                          }}
                        >
                          <TableHeaderCell
                            columnId={colId}
                            label={headerLabel}
                            fieldType={customCol?.type}
                            canManagePrefs={canManagePrefs}
                            isSorted={sortDir as false | "asc" | "desc"}
                            isPinned={isPinned}
                            onTogglePin={() => header.column.pin(isPinned ? false : "left")}
                            onSort={(dir) => {
                              if (dir === null) {
                                setTableSort(null);
                                persistFilters({ filters, sort: null, groupBy });
                              } else {
                                const targetId = isCustom
                                  ? colId.replace(/^custom:/, "")
                                  : colId;
                                const kind: TableSort["kind"] = customCol
                                  ? customCol.type
                                  : colId === "title"
                                    ? "BUILTIN_TITLE"
                                    : colId === "statusColumnId"
                                      ? "BUILTIN_STATUS"
                                      : "BUILTIN_DATE";
                                const next: TableSort = { columnId: targetId, kind, dir };
                                setTableSort(next);
                                persistFilters({ filters, sort: next, groupBy });
                              }
                            }}
                            onFilter={() => {
                              // Add empty filter — toolbar chip pops up ready for value input.
                              const targetId = isCustom
                                ? colId.replace(/^custom:/, "")
                                : colId;
                              const kind: TableFilter["kind"] = customCol
                                ? customCol.type
                                : colId === "title"
                                  ? "BUILTIN_TITLE"
                                  : colId === "statusColumnId"
                                    ? "BUILTIN_STATUS"
                                    : "BUILTIN_DATE";
                              const newFilter: TableFilter = {
                                columnId: targetId,
                                kind,
                                op:
                                  kind === "BUILTIN_STATUS" || kind === "SINGLE_SELECT"
                                    ? "equals"
                                    : kind === "NUMBER" || kind === "RATING"
                                      ? "equals"
                                      : kind === "CHECKBOX"
                                        ? "isChecked"
                                        : "contains",
                                value: "",
                              };
                              const nextFilters = [...filters, newFilter];
                              setFilters(nextFilters);
                              persistFilters({ filters: nextFilters, sort: tableSort, groupBy });
                            }}
                            onHide={() => {
                              const next = { ...columnVisibility, [colId]: false };
                              setColumnVisibility(next);
                              const hidden = Object.entries(next)
                                .filter(([, v]) => !v)
                                .map(([id]) => id);
                              persistPrefs({ hidden, columnOrder });
                            }}
                          />
                          {canResize && canManagePrefs && (
                            <div
                              onMouseDown={header.getResizeHandler()}
                              onTouchStart={header.getResizeHandler()}
                              onDoubleClick={() => header.column.resetSize()}
                              role="separator"
                              aria-orientation="vertical"
                              aria-label="Zmień szerokość kolumny"
                              title="Przeciągnij aby zmienić szerokość · dwuklik = reset"
                              // F12-K90: hit-area 6px (z 8px) bez translate-x-1.
                              // Wcześniej translate-x-1 wystawał 4px poza right edge =
                              // overlap z pierwszą cellą sąsiedniej (pinned) kolumny.
                              // Teraz handle siedzi w obrębie własnej cell'i, centered
                              // na borderze przez własną szerokość.
                              className={`absolute right-0 top-0 z-20 h-full w-1.5 cursor-col-resize select-none touch-none transition-colors ${
                                isResizing
                                  ? "bg-primary"
                                  : "bg-transparent hover:bg-primary/50"
                              }`}
                            />
                          )}
                        </th>
                      );
                    })}
                    {canManagePrefs && (
                      <th className="sticky top-0 h-11 w-12 bg-transparent px-2 text-left font-mono text-[0.69rem] font-bold uppercase tracking-[0.03em] text-muted-foreground/80">
                        <AddColumnButton workspaceId={workspaceId} boardId={boardId} />
                      </th>
                    )}
                  </tr>
                );
              })}
            </thead>
            <tbody>
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length + (canManagePrefs ? 1 : 0)}
                    className="py-16 text-center text-muted-foreground"
                  >
                    <p className="font-display text-[0.98rem] font-semibold tracking-[-0.01em]">Brak zadań.</p>
                    <p className="mt-1.5 font-mono text-[0.66rem] uppercase tracking-[0.1em] text-muted-foreground/70">
                      {filters.length > 0 ? "filtry nic nie zwróciły" : "użyj „Nowe zadanie” powyżej"}
                    </p>
                  </td>
                </tr>
              ) : (
                // When grouped, each bucket gets a colored header row + matching subset of rows.
                // Build Map<rowId, RowModel> once → O(N) instead of O(N×M) filter() per bucket.
                (() => {
                  const rowModel = table.getRowModel().rows;
                  const rowById = new Map(rowModel.map((r) => [r.original.id, r]));
                  return groupedRows.map((bucket) => {
                    const bucketRows = bucket.rows
                      .map((t) => rowById.get(t.id))
                      .filter((r): r is (typeof rowModel)[number] => Boolean(r));
                    if (bucketRows.length === 0) return null;
                  return (
                    <GroupBucket
                      key={bucket.key}
                      label={bucket.label}
                      color={bucket.color}
                      count={bucketRows.length}
                      columnCount={columns.length + (canManagePrefs ? 1 : 0)}
                      showHeader={Boolean(groupBy)}
                    >
                      {bucketRows.map((row) => {
                        const isSelected = !!rowSelection[row.id];
                        return (
                          <tr
                            key={row.id}
                            className={`group/row border-b border-border/40 last:border-b-0 transition-colors ${
                              isSelected ? "bg-primary/[0.06]" : "hover:bg-accent/30"
                            }`}
                            {...assign.rowProps(
                              row.original.id,
                              row.original.assignees.map((a) => a.id),
                            )}
                          >
                            {canEdit && (
                              <td
                                className="sticky left-0 z-10 w-11 bg-card px-3 align-middle shadow-[1px_0_0_0_var(--border)] max-md:!static max-md:!shadow-none"
                                style={{
                                  background: isSelected
                                    ? "color-mix(in oklab, var(--primary) 6%, var(--card))"
                                    : undefined,
                                }}
                                title="Klik = pojedyncze. Shift + klik = zakres od ostatnio zaznaczonego."
                              >
                                <Checkbox
                                  ariaLabel={`Zaznacz wiersz ${row.original.title} (shift+click dla zakresu)`}
                                  checked={isSelected}
                                  onClick={(e) => {
                                    if (e.shiftKey && lastClickedRowRef.current) {
                                      e.preventDefault();
                                      extendSelection(row.original.id);
                                    } else {
                                      setRowSelection((prev) => ({
                                        ...prev,
                                        [row.original.id]: !prev[row.original.id],
                                      }));
                                      e.preventDefault();
                                    }
                                    lastClickedRowRef.current = row.original.id;
                                  }}
                                  onChange={() => {
                                    /* handled in onClick to support shift+click */
                                  }}
                                />
                              </td>
                            )}
                            {(() => {
                              // Same pinned-first reorder as headers — DOM cells line up with visible columns.
                              const allCells = row.getVisibleCells();
                              const leftCells = allCells.filter(
                                (c) => c.column.getIsPinned() === "left",
                              );
                              const centerCells = allCells.filter(
                                (c) => !c.column.getIsPinned(),
                              );
                              const orderedCells = [...leftCells, ...centerCells];
                              const checkboxOffset = canEdit ? 44 : 0;
                              const visibleRowIdx = filteredSorted.findIndex(
                                (t) => t.id === row.original.id,
                              );
                              return orderedCells.map((cell, cIdx) => {
                                const isPinned = cell.column.getIsPinned() === "left";
                                const pinnedLeft = isPinned
                                  ? checkboxOffset + cell.column.getStart("left")
                                  : null;
                                const isActive =
                                  activeCell?.row === visibleRowIdx && activeCell?.col === cIdx;
                                return (
                                  <td
                                    key={cell.id}
                                    data-cell="1"
                                    data-row={visibleRowIdx}
                                    data-col={cIdx}
                                    tabIndex={0}
                                    onFocus={() => setActiveCell({ row: visibleRowIdx, col: cIdx })}
                                    // v4 spec (linia 47): padding 10/18 + border-bottom hairline.
                                    // Border line jest na <tr>, tu mamy padding + sticky bg dla pinned.
                                    // Mobile (spec linia 56): kompaktowy padding 12/8 — więcej
                                    // wierszy w viewport bez ścinania content'u (status/prio pille
                                    // i tak są małe).
                                    className={`px-[18px] py-[10px] align-middle outline-none transition-colors max-md:px-3 max-md:py-2 ${
                                      isPinned
                                        ? "sticky z-10 bg-card shadow-[1px_0_0_0_var(--border)] max-md:!static max-md:!bg-transparent max-md:!shadow-none"
                                        : ""
                                    } ${isActive ? "rounded-sm ring-2 ring-inset ring-primary/60" : ""}`}
                                    style={{
                                      width: cell.column.getSize(),
                                      ...(isPinned && pinnedLeft !== null
                                        ? { left: `${pinnedLeft}px` }
                                        : {}),
                                    }}
                                  >
                                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                  </td>
                                );
                              });
                            })()}
                            {canManagePrefs && <td className="w-12" />}
                          </tr>
                        );
                      })}
                    </GroupBucket>
                  );
                });
                })()
              )}
              {canEdit && (
                <AddRowInline
                  workspaceId={workspaceId}
                  boardId={boardId}
                  columnCount={columns.length + (canManagePrefs ? 1 : 0)}
                />
              )}
            </tbody>
          </table>
        </div>
        {/* v4 .tbl-foot (linia 71): padding 10/18, border-top hairline, glass tło.
            Hint copy 11.5px, kolor hintc (faint). <kbd> w mono z chip background. */}
        <div className="flex items-center justify-between gap-3 border-t border-border/50 bg-white/[0.02] px-[18px] py-[10px] dark:bg-white/[0.015]">
          <span className="font-mono text-[0.66rem] uppercase tracking-[0.1em] text-muted-foreground">
            <strong className="font-semibold text-foreground/80">{tasks.length}</strong>{" "}
            {taskPl(tasks.length)}
          </span>
          <span className="text-[11.5px] text-muted-foreground/80 max-md:hidden">
            Hint · najedź na zadanie i wciśnij{" "}
            <kbd className="mx-0.5 inline-flex items-center rounded-[5px] bg-white/[0.06] px-1.5 py-[1px] font-mono text-[11px] font-semibold text-foreground/80">
              M
            </kbd>{" "}
            aby przypisać
          </span>
          {/* Mobile: h-scroll hint zamiast keyboard hint'a. Mirror v4 spec linia 61
              ("← przesuń w bok aby zobaczyć kolumny"). */}
          <span className="hidden font-mono text-[0.62rem] uppercase tracking-[0.1em] text-muted-foreground/80 max-md:inline">
            ← przesuń w bok
          </span>
        </div>
      </div>

      {assign.menu}
      {selectedTaskIds.length > 0 && (
        <BulkActionsBar
          workspaceId={workspaceId}
          selectedIds={selectedTaskIds}
          statusColumns={statusColumns}
          members={members}
          onClear={() => setRowSelection({})}
        />
      )}
    </div>
  );
}

function BulkActionsBar({
  workspaceId,
  selectedIds,
  statusColumns,
  members,
  onClear,
}: {
  workspaceId: string;
  selectedIds: string[];
  statusColumns: BoardTableColumn[];
  members: AssignMember[];
  onClear: () => void;
}) {
  type MenuKind = "status" | "priority" | "assign" | null;
  const [activeMenu, setActiveMenu] = useState<MenuKind>(null);

  const submitDelete = () => {
    if (!confirm(`Usunąć ${selectedIds.length} zadań? Tego nie da się cofnąć z UI.`)) return;
    const fd = new FormData();
    fd.set("workspaceId", workspaceId);
    fd.set("ids", selectedIds.join(","));
    startTransition(async () => {
      await bulkDeleteTasksAction(fd);
      onClear();
    });
  };
  const setStatus = (statusColumnId: string) => {
    const fd = new FormData();
    fd.set("workspaceId", workspaceId);
    fd.set("ids", selectedIds.join(","));
    fd.set("statusColumnId", statusColumnId);
    startTransition(async () => {
      await bulkUpdateStatusAction(fd);
      setActiveMenu(null);
      onClear();
    });
  };
  // F12-K75: bulk set priority.
  const setBulkPriority = (priority: TaskPriorityValue) => {
    const fd = new FormData();
    fd.set("workspaceId", workspaceId);
    fd.set("ids", selectedIds.join(","));
    fd.set("priority", priority);
    startTransition(async () => {
      await bulkSetPriorityAction(fd);
      setActiveMenu(null);
      onClear();
    });
  };
  // F12-K76: bulk assign (mode add/remove). Po wyborze osoby z listy
  // domyślnie dodajemy — w submenu przycisk "−" robi remove.
  const setBulkAssignee = (userId: string, mode: "add" | "remove") => {
    const fd = new FormData();
    fd.set("workspaceId", workspaceId);
    fd.set("ids", selectedIds.join(","));
    fd.set("userId", userId);
    fd.set("mode", mode);
    startTransition(async () => {
      await bulkAssignAction(fd);
      setActiveMenu(null);
      onClear();
    });
  };

  if (typeof document === "undefined") return null;
  return createPortal(
    // v4 bulk toolbar (linia 62): rounded-[14px], padding 9/15, gap 12, glass
    // backdrop-blur(30px) + brand-tinted shadow `0 16px 36px -16px rgba(0,0,0,.6)`.
    // Counter badge to mała kwadratowa pill 22x22 z brand-gradient.
    <div className="fixed z-50 flex items-center border border-white/10 bg-popover/95 shadow-[0_16px_36px_-16px_rgba(0,0,0,0.6),0_30px_70px_-30px_rgba(122,51,236,0.4)] backdrop-blur-md max-md:inset-x-0 max-md:bottom-0 max-md:gap-1.5 max-md:rounded-t-[18px] max-md:border-x-0 max-md:border-b-0 max-md:px-3 max-md:pt-2 max-md:pb-safe-bottom md:bottom-6 md:left-1/2 md:max-w-[calc(100vw-24px)] md:-translate-x-1/2 md:gap-3 md:rounded-[14px] md:px-[15px] md:py-[9px]">
      {/* Counter pill — na mobile w odrębnej "header" rzeczy. Tu rendrujemy
          ją absolutnie na top mobile sheet'a + jako pierwszy element desktopu. */}
      <span className="inline-flex h-[22px] w-[22px] items-center justify-center rounded-[7px] bg-brand-gradient text-[11px] font-bold text-white max-md:absolute max-md:-top-2.5 max-md:left-1/2 max-md:-translate-x-1/2 max-md:rounded-full max-md:h-[26px] max-md:w-auto max-md:px-2.5 max-md:text-[12px] max-md:shadow-brand">
        {selectedIds.length}
      </span>
      <span className="text-[12.5px] font-semibold text-foreground max-md:hidden">zaznaczone</span>
      <span className="h-4 w-px bg-white/15 max-md:hidden" />

      {/* Zmień status */}
      <div className="relative max-md:flex-1">
        <button
          type="button"
          onClick={() => setActiveMenu((m) => (m === "status" ? null : "status"))}
          className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[0.78rem] font-medium text-foreground transition-colors hover:bg-accent max-md:flex max-md:min-h-[52px] max-md:w-full max-md:flex-col max-md:items-center max-md:gap-1 max-md:rounded-[10px] max-md:bg-white/5 max-md:px-1 max-md:py-1.5 max-md:text-[10.5px]"
        >
          <span className="h-2 w-2 rounded-full bg-amber-500 max-md:h-2.5 max-md:w-2.5" />
          Status
        </button>
        {activeMenu === "status" && (
          <div className="absolute bottom-[calc(100%+8px)] left-1/2 max-h-[280px] -translate-x-1/2 overflow-y-auto rounded-xl border border-border/70 bg-popover/95 p-1 shadow-[0_18px_40px_-16px_rgba(122,51,236,0.36)] backdrop-blur-md">
            <button
              type="button"
              onClick={() => setStatus("")}
              className="block w-full whitespace-nowrap rounded-md px-2.5 py-1.5 text-left text-[0.78rem] text-muted-foreground transition-colors hover:bg-accent"
            >
              — brak —
            </button>
            {statusColumns.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setStatus(s.id)}
                className="flex w-full items-center gap-2 whitespace-nowrap rounded-md px-2.5 py-1.5 text-left text-[0.78rem] transition-colors hover:bg-accent"
                style={{ color: s.colorHex }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: s.colorHex }}
                />
                {s.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* F12-K75: Zmień priorytet */}
      <div className="relative max-md:flex-1">
        <button
          type="button"
          onClick={() => setActiveMenu((m) => (m === "priority" ? null : "priority"))}
          className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[0.78rem] font-medium text-foreground transition-colors hover:bg-accent max-md:flex max-md:min-h-[52px] max-md:w-full max-md:flex-col max-md:items-center max-md:gap-1 max-md:rounded-[10px] max-md:bg-white/5 max-md:px-1 max-md:py-1.5 max-md:text-[10.5px]"
        >
          <span className="h-2 w-2 rounded-full bg-rose-500 max-md:h-2.5 max-md:w-2.5" />
          <span className="max-md:hidden">Priorytet</span>
          <span className="hidden max-md:inline">Prio</span>
        </button>
        {activeMenu === "priority" && (
          <div className="absolute bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2 rounded-xl border border-border/70 bg-popover/95 p-1 shadow-[0_18px_40px_-16px_rgba(122,51,236,0.36)] backdrop-blur-md">
            {PRIORITY_VALUES.map((value) => {
              const meta = PRIORITY_META[value];
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setBulkPriority(value)}
                  className="flex w-full items-center justify-between gap-3 whitespace-nowrap rounded-md px-2.5 py-1.5 text-left text-[0.78rem] transition-colors hover:bg-accent"
                >
                  <span className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{
                        background:
                          value === "NONE" ? "transparent" : meta.dotColor,
                        border:
                          value === "NONE"
                            ? "1px dashed currentColor"
                            : undefined,
                      }}
                    />
                    <span className={value === "NONE" ? "text-muted-foreground" : ""}>
                      {meta.label}
                    </span>
                  </span>
                  <span className="font-mono text-[0.6rem] uppercase tracking-[0.08em] text-muted-foreground/60">
                    {meta.shortCode}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* F12-K76: Przypisz osobę */}
      <div className="relative max-md:flex-1">
        <button
          type="button"
          onClick={() => setActiveMenu((m) => (m === "assign" ? null : "assign"))}
          className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[0.78rem] font-medium text-foreground transition-colors hover:bg-accent max-md:flex max-md:min-h-[52px] max-md:w-full max-md:flex-col max-md:items-center max-md:gap-1 max-md:rounded-[10px] max-md:bg-white/5 max-md:px-1 max-md:py-1.5 max-md:text-[10.5px]"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-muted-foreground"
            aria-hidden="true"
          >
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21v-2a6 6 0 0 1 12 0v2" />
          </svg>
          Osoba
        </button>
        {activeMenu === "assign" && members.length > 0 && (
          <div className="absolute bottom-[calc(100%+8px)] left-1/2 max-h-[280px] -translate-x-1/2 overflow-y-auto rounded-xl border border-border/70 bg-popover/95 p-1 shadow-[0_18px_40px_-16px_rgba(122,51,236,0.36)] backdrop-blur-md">
            {members.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-2 whitespace-nowrap rounded-md px-2 py-1"
              >
                <button
                  type="button"
                  onClick={() => setBulkAssignee(m.id, "add")}
                  className="flex flex-1 items-center gap-2 text-left text-[0.78rem] transition-colors hover:text-primary"
                  title="Przypisz do zaznaczonych"
                >
                  <span className="grid h-5 w-5 shrink-0 place-items-center overflow-hidden rounded-full bg-brand-gradient text-[0.55rem] font-bold text-white">
                    {(m.name ?? m.email).slice(0, 2).toUpperCase()}
                  </span>
                  <span>{m.name ?? m.email.split("@")[0]}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setBulkAssignee(m.id, "remove")}
                  className="grid h-5 w-5 place-items-center rounded-md text-muted-foreground/60 transition-colors hover:bg-rose-500/10 hover:text-rose-500"
                  title="Usuń przypisanie"
                >
                  −
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <span className="h-4 w-px bg-white/15 max-md:hidden" />
      <button
        type="button"
        onClick={submitDelete}
        className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[0.78rem] font-medium text-rose-500 transition-colors hover:bg-rose-500/10 max-md:flex max-md:min-h-[52px] max-md:flex-1 max-md:flex-col max-md:items-center max-md:gap-1 max-md:rounded-[10px] max-md:bg-rose-500/10 max-md:px-1 max-md:py-1.5 max-md:text-[10.5px]"
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
        </svg>
        Usuń
      </button>
      <span className="h-4 w-px bg-white/15 max-md:hidden" />
      {/* Mobile: close X przyklejony absolutnie do prawego rogu sticky bar'a,
          desktop: inline ostatni element. */}
      <button
        type="button"
        onClick={onClear}
        aria-label="Wyczyść zaznaczenie"
        className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground max-md:absolute max-md:right-2 max-md:top-2 max-md:h-8 max-md:w-8 max-md:rounded-full max-md:bg-white/10"
      >
        <X size={12} className="max-md:size-[14px]" />
      </button>
    </div>,
    document.body,
  );
}

// Drag-resize overrides persist on top of these defaults.
function defaultSizeForType(type: FieldType): number {
  switch (type) {
    case "CHECKBOX":
      return 90;
    case "RATING":
      return 130;
    case "NUMBER":
    case "AUTO_NUMBER":
      return 130;
    case "DATE":
    case "CREATED_TIME":
    case "LAST_MODIFIED_TIME":
      return 180;
    case "PHONE":
      return 160;
    case "URL":
    case "EMAIL":
      return 220;
    case "LONG_TEXT":
      return 300;
    case "MULTI_SELECT":
      return 220;
    case "SINGLE_SELECT":
      return 160;
    case "USER":
      return 160;
    case "ATTACHMENT":
      return 200;
    default:
      return 200;
  }
}

function DateCell({
  taskId,
  field,
  value,
  disabled,
}: {
  taskId: string;
  field: "startAt" | "stopAt";
  value: string | null;
  disabled: boolean;
}) {
  if (disabled) {
    // v4: font-mono dla dat — w designie 12px, lekko stonowane kolorystycznie.
    return value ? (
      <span className="font-mono text-[0.76rem] text-muted-foreground">
        {new Date(value).toLocaleString("pl-PL", {
          dateStyle: "short",
          timeStyle: "short",
        })}
      </span>
    ) : (
      <MutedDash />
    );
  }
  // F12-K122: try/catch wokół patchTaskAction. Wcześniej startTransition
  // połykał błędy (np. milestone constraint date range), klient widział że
  // kalendarz się zamyka ale po refresh wracała stara data. Teraz error =
  // alert z server message + router.refresh() żeby UI od razu pokazało
  // canonical state z DB (lokalny DateTimePicker state.date jest dynamic ale
  // po refresh `value` prop dostaje aktualną wartość → useEffect setDate sync).
  const router = useRouter();
  const persist = (iso: string) => {
    const fd = new FormData();
    fd.set("id", taskId);
    fd.set(field, iso);
    startTransition(async () => {
      try {
        await patchTaskAction(fd);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Nie udało się zapisać daty.";
        window.alert(msg);
        router.refresh();
      }
    });
  };
  return (
    <DateTimePicker
      // `name` unused in cell mode (no wrapping form) — kept for a11y tooling.
      name={field}
      defaultValue={value}
      variant="cell"
      placeholder={field === "startAt" ? "Brak daty startu" : "Brak daty końca"}
      onChange={persist}
    />
  );
}

function MutedDash() {
  // v4: cienki dash w kolumnach dat gdy pusto — font-mono żeby wizualnie pasowało do dat.
  return <span className="font-mono text-[0.72rem] text-muted-foreground/50">—</span>;
}

// When `showHeader` is false we render only children — non-grouped path stays unchanged.
function GroupBucket({
  label,
  color,
  count,
  columnCount,
  showHeader,
  children,
}: {
  label: string;
  color?: string;
  count: number;
  columnCount: number;
  showHeader: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  if (!showHeader) return <>{children}</>;
  const accent = color ?? "var(--muted-foreground)";
  return (
    <>
      {/* v4 group header (linia 45): padding 9/18, ChevronDown 12px, dot 9x9,
          name 12.5/700, count pill bg rgba(255,255,255,.06) radius 999.
          Sub-row sticky-ish vibe: lekkie tło dla rozróżnienia bucketów. */}
      <tr className="bg-white/[0.03] dark:bg-white/[0.025]">
        <td colSpan={columnCount} className="px-[18px] py-[9px]">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="inline-flex items-center gap-[9px] text-left transition-opacity hover:opacity-80"
          >
            <span
              className="grid h-3 w-3 place-items-center text-muted-foreground transition-transform"
              style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)" }}
              aria-hidden="true"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </span>
            <span
              className="h-[9px] w-[9px] rounded-full"
              style={{ background: accent }}
            />
            <span className="text-[12.5px] font-bold leading-none text-foreground">
              {label || "—"}
            </span>
            <span className="inline-flex items-center rounded-full bg-white/[0.06] px-[7px] py-[1px] text-[11px] font-medium text-muted-foreground">
              {count}
            </span>
          </button>
        </td>
      </tr>
      {open && children}
    </>
  );
}

// Portal-rendered popover at viewport-fixed coords so internal scroll never moves the overflow-x-auto table.
function AddColumnButton({
  workspaceId,
  boardId,
}: {
  workspaceId: string;
  boardId: string;
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    maxHeight: number;
    placement: "below" | "above";
  } | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState<FieldType>("TEXT");
  const [options, setOptions] = useState<FieldOptions>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  const closeReset = () => {
    setName("");
    setType("TEXT");
    setOptions({});
    setOpen(false);
    setCoords(null);
  };

  // Flip above if not enough room below; clamp maxHeight so footer never falls off-screen.
  const computeCoords = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const POP_WIDTH = 320;
    const GAP = 6;
    const PAGE_PAD = 16;
    const spaceBelow = window.innerHeight - rect.bottom - GAP - PAGE_PAD;
    const spaceAbove = rect.top - GAP - PAGE_PAD;
    const wantBelow = spaceBelow >= 300 || spaceBelow >= spaceAbove;
    const placement: "below" | "above" = wantBelow ? "below" : "above";
    const maxHeight = Math.max(220, wantBelow ? spaceBelow : spaceAbove);
    const top = wantBelow ? rect.bottom + GAP : Math.max(PAGE_PAD, rect.top - GAP - maxHeight);
    const left = Math.max(8, Math.min(window.innerWidth - POP_WIDTH - 8, rect.right - POP_WIDTH));
    return { top, left, maxHeight, placement };
  };

  const openWithCoords = () => {
    const c = computeCoords();
    if (!c) return;
    setCoords(c);
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (
        !popRef.current?.contains(e.target as Node) &&
        !triggerRef.current?.contains(e.target as Node)
      ) {
        closeReset();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeReset();
    };
    // Recompute on resize/scroll to keep popover anchored.
    const onReflow = () => {
      const c = computeCoords();
      if (c) setCoords(c);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onReflow);
    window.addEventListener("scroll", onReflow, true);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onReflow);
      window.removeEventListener("scroll", onReflow, true);
    };
  }, [open]);

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const fd = new FormData();
    fd.set("workspaceId", workspaceId);
    fd.set("boardId", boardId);
    fd.set("name", trimmed);
    fd.set("type", type);
    fd.set("options", JSON.stringify(options ?? {}));
    startTransition(async () => {
      await createTableColumnAction(fd);
      closeReset();
    });
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? closeReset() : openWithCoords())}
        aria-label="Dodaj kolumnę"
        title="Dodaj kolumnę"
        className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-[transform,background-color,color] hover:scale-105 hover:bg-accent hover:text-foreground"
      >
        <Plus size={13} />
      </button>
      {open && coords && typeof document !== "undefined" &&
        createPortal(
          <div
            ref={popRef}
            style={{
              position: "fixed",
              top: coords.top,
              left: coords.left,
              width: 320,
              maxHeight: coords.maxHeight,
            }}
            // z-[200] === Z.popoverInModal (F12-K104).
            className="z-[200] flex flex-col overflow-hidden rounded-xl border border-border/70 bg-popover/95 shadow-[0_18px_40px_-16px_rgba(122,51,236,0.36)] backdrop-blur-md"
          >
            <div className="shrink-0 border-b border-border/70 px-3 py-2.5">
              <p className="font-mono text-[0.62rem] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                Nowa kolumna
              </p>
            </div>
            {/* min-h-0 is required so flex-1 + overflow-y-auto clips the middle section instead of stretching. */}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && name.trim()) {
                    e.preventDefault();
                    submit();
                  }
                }}
                maxLength={80}
                placeholder="Nazwa pola…"
                className="mb-3 w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-[0.86rem] outline-none transition-colors focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
              />
              <p className="mb-1.5 font-mono text-[0.6rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground/80">
                Typ
              </p>
              <FieldTypePicker value={type} onChange={setType} />
              <div className="mt-3 space-y-2">
                <FieldOptionsEditor type={type} value={options} onChange={setOptions} />
              </div>
            </div>
            <div className="shrink-0 flex items-center justify-end gap-2 border-t border-border/70 bg-popover/95 px-3 py-2.5">
              <button
                type="button"
                onClick={closeReset}
                className="font-mono text-[0.62rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground transition-colors hover:text-foreground"
              >
                Anuluj
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={!name.trim()}
                className="inline-flex h-7 items-center rounded-md bg-brand-gradient px-3 font-mono text-[0.62rem] font-bold uppercase tracking-[0.1em] text-white shadow-[0_6px_16px_-6px_rgba(122,51,236,0.6)] transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                Dodaj kolumnę
              </button>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

function AddRowInline({
  workspaceId,
  boardId,
  columnCount,
}: {
  workspaceId: string;
  boardId: string;
  columnCount: number;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const submit = () => {
    const trimmed = title.trim();
    if (!trimmed) {
      setEditing(false);
      return;
    }
    const fd = new FormData();
    fd.set("workspaceId", workspaceId);
    fd.set("boardId", boardId);
    fd.set("title", trimmed);
    startTransition(async () => {
      await createTaskAction(null, fd);
      setTitle("");
      // Stay in edit mode — user can keep firing rows without clicking again.
    });
  };
  return (
    // v4 .tbl-newrow — dashed border-t, subtle hover. Inline "+ Nowy wiersz".
    <tr className="group/newrow border-t border-dashed border-border/60 transition-colors hover:border-primary/30 hover:bg-primary/[0.03]">
      <td colSpan={columnCount} className="px-4 py-3">
        {editing ? (
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={submit}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              } else if (e.key === "Escape") {
                setTitle("");
                setEditing(false);
              }
            }}
            maxLength={2000}
            placeholder="Tytuł zadania…"
            className="w-full bg-transparent text-[0.9rem] font-medium outline-none placeholder:text-muted-foreground/50"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-2 font-mono text-[0.66rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground transition-colors group-hover/newrow:text-primary"
          >
            <Plus size={12} strokeWidth={2.4} /> Nowy wiersz
          </button>
        )}
      </td>
    </tr>
  );
}
