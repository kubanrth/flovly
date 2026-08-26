"use client";

// Lista (B1): real <table>, sticky 32px header, frozen ☐/#ID/Tytuł, inline edit
// of every cell, grouping with Σ, bulk bar, keyboard nav, windowed rows ≥300.
// Filters/sort/group/columns come from ListStateProvider (shared with the toolbar).

import { startTransition, useCallback, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createTaskAction, patchTaskAction } from "@/app/(app)/w/[workspaceId]/t/actions";
import { useWorkspaceRealtime } from "@/hooks/use-workspace-realtime";
import { DENSITY_PX, useUiPref, type Density } from "@/hooks/use-ui-pref";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { plPlural, taskPl } from "@/lib/pluralize";
import { PRIORITY_WEIGHT } from "@/lib/task-priority";
import { compareValues, matchesFilter, type TableFilter, type TableSort } from "@/lib/table-filters";
import { parseFieldOptions, type FieldOptions } from "@/lib/table-fields";
import { useAssignHotkey } from "@/components/task/assign-hotkey";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { nextSelection } from "./selection";
import { StatusChip } from "@/components/ui/chip";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { IconChevronDown, IconPlus, IconRoadmap } from "@/components/ui/icons";
import { useListState } from "@/components/table/list-state";
import { BUILTIN_COLUMNS, CHECKBOX_W, FROZEN_IDS, customColId, defaultWidthForType, isCustomColId, orderedColumnIds, rawColId, sortKindFor } from "@/components/table/columns";
import { TableHeaderCell } from "@/components/table/header-cell";
import { BuiltinColumnIcon, FieldTypeIcon } from "@/components/table/field-icons";
import { StatusPicker } from "@/components/table/status-picker";
import { PriorityPickerCell } from "@/components/table/priority-picker-cell";
import { AssigneePickerCell, TagPickerCell } from "@/components/table/cell-pickers";
import { FieldCell } from "@/components/table/field-cells";
import { AttachmentCell } from "@/components/table/attachment-cell";
import { AddColumnButton } from "@/components/table/add-column-form";
import { RowHints } from "@/components/table/row-hints";
import { BulkBar } from "@/components/table/bulk-bar";
import { MobileList } from "@/components/table/mobile-list";
import { groupTasks, type GroupBucket } from "@/components/table/grouping";
import { isActiveFilter, newFilter } from "@/components/table/filter-builder";
import { memberName, type BoardTableTask, type CustomTableColumn } from "@/components/table/types";

export type { BoardTableColumn, BoardTableTask, CustomTableColumn } from "@/components/table/types";

const GROUP_H = 36;
const ADD_H = 36;
const FOOTER_H = 32;
const VIRTUAL_MIN = 300;
const OVERSCAN = 8;
const dayFmt = new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "short" });
const formatDay = (d: Date) => dayFmt.format(d);

interface ColumnModel {
  id: string;
  label: string;
  width: number;
  minWidth: number;
  frozen: boolean;
  pinned: boolean;
  left: number;
  custom?: CustomTableColumn;
  fieldOptions?: FieldOptions;
}

type Item =
  | { kind: "group"; g: GroupBucket; h: number }
  | { kind: "row"; t: BoardTableTask; i: number; h: number }
  | { kind: "add"; h: number };

// Raw string per (task, filter) the way lib/table-filters expects it; list-like
// columns become JSON arrays so hasAny/hasAll/isEmpty work.
function filterValue(t: BoardTableTask, f: TableFilter): string {
  const arr = (ids: string[]) => (ids.length ? JSON.stringify(ids) : "");
  switch (f.columnId) {
    case "title": return t.title;
    case "statusColumnId": return f.kind === "MULTI_SELECT" ? arr(t.statusColumnId ? [t.statusColumnId] : []) : (t.statusColumnId ?? "");
    case "priority": return t.priority === "NONE" ? "" : f.kind === "MULTI_SELECT" ? arr([t.priority]) : t.priority;
    case "assignees": return arr(t.assignees.map((a) => a.id));
    case "tags": return arr(t.tags.map((x) => x.id));
    case "startAt": return t.startAt ?? "";
    case "stopAt": return t.stopAt ?? "";
    case "attachments": return arr(t.attachments.map((a) => a.id));
    case "milestone": return t.milestone?.title ?? "";
    default: return t.customValues[f.columnId] ?? "";
  }
}

export function BoardTable({ tasks }: { tasks: BoardTableTask[] }) {
  const s = useListState();
  const { workspaceId, boardId, viewId, canEdit, canManagePrefs, statusColumns, customColumns, members, allTags, config, search } = s;
  const router = useRouter();
  useWorkspaceRealtime(workspaceId);
  const assign = useAssignHotkey({ members, workspaceId });
  const isMobile = useIsMobile();
  const [density] = useUiPref<Density>("ui:density", "comfortable");
  const rowH = DENSITY_PX[density];

  // ─── columns ────────────────────────────────────────────────────────────
  const columns = useMemo<ColumnModel[]>(() => {
    const customIds = customColumns.map((c) => customColId(c.id));
    const order = orderedColumnIds(config.columnOrder, customIds);
    const hidden = new Set(config.hidden);
    const pinnedSet = new Set([...FROZEN_IDS, ...config.pinned]);
    const visible = order.filter((id) => FROZEN_IDS.includes(id) || !hidden.has(id));
    const ordered = [...visible.filter((id) => pinnedSet.has(id)), ...visible.filter((id) => !pinnedSet.has(id))];
    let left = canEdit ? CHECKBOX_W : 0;
    return ordered.map((id) => {
      const custom = isCustomColId(id) ? customColumns.find((c) => c.id === rawColId(id)) : undefined;
      const def = BUILTIN_COLUMNS.find((c) => c.id === id);
      const width = config.widths[id] ?? (custom ? defaultWidthForType(custom.type) : (def?.width ?? 160));
      const pinned = pinnedSet.has(id);
      const m: ColumnModel = { id, label: custom?.name ?? def?.label ?? id, width, minWidth: def?.minWidth ?? 60, frozen: FROZEN_IDS.includes(id), pinned, left, custom, fieldOptions: custom ? parseFieldOptions(custom.options) : undefined };
      if (pinned) left += width;
      return m;
    });
  }, [customColumns, config.columnOrder, config.hidden, config.pinned, config.widths, canEdit]);
  const lastPinnedId = [...columns].reverse().find((c) => c.pinned)?.id;
  const colCount = columns.length + (canEdit ? 1 : 0) + (canManagePrefs ? 1 : 0);
  const totalWidth = (canEdit ? CHECKBOX_W : 0) + columns.reduce((a, c) => a + c.width, 0) + (canManagePrefs ? 40 : 0);

  // ─── filter → search → sort ─────────────────────────────────────────────
  const deferredSearch = useDeferredValue(search);
  const activeFilters = useMemo(() => config.filters.filter(isActiveFilter), [config.filters]);
  const statusIndex = useMemo(() => new Map(statusColumns.map((st, i) => [st.id, i])), [statusColumns]);
  const sortKey = useCallback((t: BoardTableTask, sort: TableSort): string => {
    switch (sort.columnId) {
      case "displayId": return String(t.displayId);
      case "title": return t.title;
      case "statusColumnId": return t.statusColumnId ? String(statusIndex.get(t.statusColumnId) ?? 999).padStart(4, "0") : "";
      case "priority": return t.priority === "NONE" ? "" : String(PRIORITY_WEIGHT[t.priority]);
      case "assignees": return t.assignees[0] ? memberName(t.assignees[0]) : "";
      case "tags": return t.tags[0]?.name ?? "";
      case "startAt": return t.startAt ?? "";
      case "stopAt": return t.stopAt ?? "";
      case "attachments": return String(t.attachments.length);
      case "milestone": return t.milestone?.title ?? "";
      default: return t.customValues[sort.columnId] ?? "";
    }
  }, [statusIndex]);
  const filteredSorted = useMemo(() => {
    let rows = tasks;
    if (activeFilters.length > 0) rows = rows.filter((t) => activeFilters.every((f) => matchesFilter(f, filterValue(t, f))));
    const q = deferredSearch.trim().toLowerCase();
    if (q) rows = rows.filter((t) => t.title.toLowerCase().includes(q) || String(t.displayId) === q.replace(/^#/, "") || Object.values(t.customValues).some((v) => v && v.toLowerCase().includes(q)));
    const sort = config.sort;
    if (sort) {
      const mul = sort.dir === "asc" ? 1 : -1;
      rows = [...rows].sort((a, b) => mul * compareValues(sortKey(a, sort), sortKey(b, sort), sort.kind));
    }
    return rows;
  }, [tasks, activeFilters, deferredSearch, config.sort, sortKey]);

  // ─── groups + flat item list ───────────────────────────────────────────
  const groups = useMemo(() => groupTasks(filteredSorted, config.groupBy, { statusColumns, customColumns }), [filteredSorted, config.groupBy, statusColumns, customColumns]);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const toggleGroup = (key: string) =>
    setCollapsed((c) => {
      const n = new Set(c);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  const { items, rows, rowItemIndex } = useMemo(() => {
    const items: Item[] = [];
    const rows: BoardTableTask[] = [];
    const rowItemIndex: number[] = [];
    for (const g of groups) {
      if (config.groupBy) items.push({ kind: "group", g, h: GROUP_H });
      if (collapsed.has(g.key)) continue;
      for (const t of g.rows) {
        rowItemIndex.push(items.length);
        items.push({ kind: "row", t, i: rows.length, h: rowH });
        rows.push(t);
      }
    }
    if (canEdit) items.push({ kind: "add", h: ADD_H });
    return { items, rows, rowItemIndex };
  }, [groups, collapsed, config.groupBy, rowH, canEdit]);

  // ─── selection ─────────────────────────────────────────────────────────
  const [selection, setSelection] = useState<Record<string, boolean>>({});
  const lastClicked = useRef<string | null>(null);
  // base-ui re-dispatches the click on its hidden input, so an onClick handler
  // fires twice per interaction (and the second one has no useful modifier).
  // Selection therefore hangs off onCheckedChange (once per interaction) and
  // reads Shift from the native event that started it.
  const shiftDown = useRef(false);
  useEffect(() => {
    const track = (e: MouseEvent | KeyboardEvent) => { shiftDown.current = e.shiftKey; };
    document.addEventListener("mousedown", track, true);
    document.addEventListener("keydown", track, true);
    return () => {
      document.removeEventListener("mousedown", track, true);
      document.removeEventListener("keydown", track, true);
    };
  }, []);
  const toggleSelect = useCallback((id: string, shift: boolean) => {
    // Read the anchor here, not inside the updater: React runs the updater
    // lazily, by which time lastClicked has already been moved to `id`.
    const from = lastClicked.current;
    lastClicked.current = id;
    setSelection((prev) => nextSelection(prev, rows.map((t) => t.id), id, from, shift));
  }, [rows]);
  const selectedTasks = useMemo(() => tasks.filter((t) => selection[t.id]), [tasks, selection]);
  const allChecked = rows.length > 0 && rows.every((t) => selection[t.id]);
  const someChecked = rows.some((t) => selection[t.id]);

  // ─── scroll region: fills the main column; windowed rows when large ────
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewH, setViewH] = useState(600);
  const [viewW, setViewW] = useState(1000);
  useLayoutEffect(() => {
    const el = scrollRef.current;
    const main = el?.closest<HTMLElement>('[data-ui="main"]');
    if (!el || !main) return;
    const update = () => {
      const top = el.getBoundingClientRect().top - main.getBoundingClientRect().top + main.scrollTop;
      const h = Math.max(240, main.clientHeight - top - FOOTER_H);
      el.style.height = `${h}px`;
      setViewH(h);
      setViewW(el.clientWidth);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(main);
    const header = main.querySelector('[data-ui="board-header"]');
    if (header) ro.observe(header);
    return () => ro.disconnect();
  }, [isMobile]);
  // The list owns its scroll (its own container, not window/[data-ui=main]), so
  // it also owns restoring it — opening a task re-renders the board and would
  // otherwise drop the reader back to the top (AK74).
  const scrollKey = `flovly:listScroll:${boardId}`;
  const rafRef = useRef(0);
  const onScroll = () => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      const top = scrollRef.current?.scrollTop ?? 0;
      setScrollTop(top);
      try { sessionStorage.setItem(scrollKey, String(top)); } catch { /* private mode */ }
    });
  };
  useEffect(() => {
    let saved = 0;
    try { saved = Number(sessionStorage.getItem(scrollKey)) || 0; } catch { /* private mode */ }
    if (saved <= 0) return;
    // Rows stream in after the shell; retry until the container is tall enough.
    const apply = () => {
      const el = scrollRef.current;
      if (el && el.scrollHeight > saved) { el.scrollTop = saved; setScrollTop(saved); }
    };
    apply();
    const timers = [50, 150, 300, 600].map((ms) => setTimeout(apply, ms));
    return () => timers.forEach(clearTimeout);
  }, [scrollKey]);
  const virtual = tasks.length >= VIRTUAL_MIN;
  const offsets = useMemo(() => {
    const o = new Array<number>(items.length + 1);
    o[0] = 0;
    for (let i = 0; i < items.length; i++) o[i + 1] = o[i]! + items[i]!.h;
    return o;
  }, [items]);
  let start = 0, end = items.length;
  if (virtual) {
    const lo = scrollTop - OVERSCAN * rowH, hi = scrollTop + viewH + OVERSCAN * rowH;
    while (start < items.length && offsets[start + 1]! < lo) start++;
    end = start;
    while (end < items.length && offsets[end]! < hi) end++;
  }
  const padTop = offsets[start] ?? 0;
  const padBottom = (offsets[items.length] ?? 0) - (offsets[end] ?? 0);

  // ─── active cell + keyboard ────────────────────────────────────────────
  const [active, setActive] = useState({ row: 0, col: 0 });
  const tableRef = useRef<HTMLTableElement>(null);
  const pendingFocus = useRef(false);
  const focusCell = useCallback((row: number, col: number) => {
    const r = Math.max(0, Math.min(rows.length - 1, row));
    const c = Math.max(0, Math.min(columns.length - 1, col));
    setActive({ row: r, col: c });
    pendingFocus.current = true;
    const el = scrollRef.current;
    const idx = rowItemIndex[r];
    if (el && idx !== undefined) {
      const top = offsets[idx]!, bottom = top + rowH;
      const headerH = 32;
      if (top < el.scrollTop + headerH) el.scrollTop = top - headerH;
      else if (bottom > el.scrollTop + el.clientHeight) el.scrollTop = bottom - el.clientHeight;
    }
  }, [rows.length, columns.length, rowItemIndex, offsets, rowH]);
  useEffect(() => {
    if (!pendingFocus.current) return;
    pendingFocus.current = false;
    tableRef.current?.querySelector<HTMLElement>(`td[data-row="${active.row}"][data-col="${active.col}"]`)?.focus();
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const titleCol = columns.findIndex((c) => c.id === "title");
  const openTask = (t: BoardTableTask) => router.push(`/w/${workspaceId}/t/${t.id}`);

  const onKeyDown = (e: ReactKeyboardEvent<HTMLTableElement>) => {
    const target = e.target as HTMLElement;
    const tag = target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable) return;
    const onCell = target.dataset.cell !== undefined;
    const { row, col } = active;
    const t = rows[row];
    const key = e.key;
    if (onCell) {
      if (key === "ArrowDown") { e.preventDefault(); focusCell(row + 1, col); return; }
      if (key === "ArrowUp") { e.preventDefault(); focusCell(row - 1, col); return; }
      if (key === "ArrowLeft") { e.preventDefault(); focusCell(row, col - 1); return; }
      if (key === "ArrowRight") { e.preventDefault(); focusCell(row, col + 1); return; }
      if (key === "Tab") {
        e.preventDefault();
        if (e.shiftKey) {
          if (col > 0) focusCell(row, col - 1);
          else focusCell(row - 1, columns.length - 1);
        } else if (col < columns.length - 1) focusCell(row, col + 1);
        else focusCell(row + 1, 0);
        return;
      }
      if (key === "Enter" || key === "F2") {
        e.preventDefault();
        if (!t) return;
        if (col === titleCol) {
          if (key === "F2") setEditingId(t.id);
          else openTask(t);
        } else {
          target.querySelector<HTMLElement>("button, input, textarea, a, [role=checkbox]")?.focus();
          if (key === "Enter") target.querySelector<HTMLElement>("button, [role=checkbox]")?.click();
        }
        return;
      }
    }
    if ((key === "j" || key === "k") && !e.metaKey && !e.ctrlKey) { e.preventDefault(); focusCell(row + (key === "j" ? 1 : -1), col); return; }
    if (key === "x" && t && !e.metaKey && !e.ctrlKey) { e.preventDefault(); toggleSelect(t.id, e.shiftKey); return; }
    if (key === "Enter" && t && !onCell && target.tagName === "TR") { e.preventDefault(); openTask(t); }
  };

  // ⌘F → toolbar search.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "f") {
        const input = document.querySelector<HTMLInputElement>('[data-ui="board-search"]');
        if (input) {
          e.preventDefault();
          input.focus();
          input.select();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // ─── live region + CSV export ──────────────────────────────────────────
  const announce = s.announce;
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    announce(`Pokazano ${filteredSorted.length} z ${tasks.length} ${taskPl(tasks.length)}`);
  }, [filteredSorted.length, tasks.length, announce]);
  const selectedCount = selectedTasks.length;
  useEffect(() => {
    if (selectedCount > 0) announce(`Zaznaczono ${selectedCount} ${taskPl(selectedCount)}`);
  }, [selectedCount, announce]);
  const registerExport = s.registerExport;
  useEffect(() => {
    registerExport(() => {
      const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
      const head = ["#ID", "Tytuł", "Status", "Priorytet", "Przypisani", "Tagi", "Start", "Koniec", "Milestone", ...customColumns.map((c) => c.name)];
      const lines = filteredSorted.map((t) => [
        String(t.displayId), t.title, statusColumns.find((st) => st.id === t.statusColumnId)?.name ?? "", t.priority === "NONE" ? "" : t.priority,
        t.assignees.map(memberName).join(", "), t.tags.map((x) => x.name).join(", "), t.startAt ?? "", t.stopAt ?? "", t.milestone?.title ?? "",
        ...customColumns.map((c) => t.customValues[c.id] ?? ""),
      ].map(esc).join(";"));
      const blob = new Blob([`﻿${[head.map(esc).join(";"), ...lines].join("\n")}`], { type: "text/csv;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "lista.csv";
      a.click();
      URL.revokeObjectURL(a.href);
    });
    return () => registerExport(null);
  }, [filteredSorted, customColumns, statusColumns, registerExport]);

  // ─── header actions ────────────────────────────────────────────────────
  const sortIdFor = (c: ColumnModel) => (c.custom ? c.custom.id : c.id);
  const filterColumnFor = (c: ColumnModel) => s.filterColumns.find((f) => f.id === sortIdFor(c));
  const groupIdFor = (c: ColumnModel) => (c.custom ? c.custom.id : c.id === "tags" ? "preset:tagsAlpha" : ["statusColumnId", "priority", "title", "startAt", "stopAt", "milestone"].includes(c.id) ? c.id : null);

  // ─── column resize (pointer drag on the header edge) ───────────────────
  const startResize = (c: ColumnModel) => (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const startX = e.clientX, startW = c.width;
    const onMove = (ev: PointerEvent) => s.setColumnPrefs({ widths: { ...s.config.widths, [c.id]: Math.max(c.minWidth, Math.round(startW + ev.clientX - startX)) } });
    const onUp = () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  };

  // ─── cells ─────────────────────────────────────────────────────────────
  const [titleOverride, setTitleOverride] = useState<Record<string, string>>({});
  // Fresh server rows win over optimistic titles (derive-during-render, not an effect).
  const [prevTasks, setPrevTasks] = useState(tasks);
  if (prevTasks !== tasks) {
    setPrevTasks(tasks);
    setTitleOverride({});
  }
  const commitTitle = (t: BoardTableTask, value: string) => {
    setEditingId(null);
    const next = value.trim();
    if (!next || next === t.title) return;
    setTitleOverride((o) => ({ ...o, [t.id]: next }));
    const fd = new FormData();
    fd.set("id", t.id);
    fd.set("title", next);
    startTransition(() => patchTaskAction(fd));
  };
  const persistDate = (t: BoardTableTask, field: "startAt" | "stopAt", iso: string) => {
    const fd = new FormData();
    fd.set("id", t.id);
    fd.set(field, iso);
    startTransition(async () => {
      try {
        await patchTaskAction(fd);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "";
        if (msg && !msg.includes("Server Components render") && !msg.startsWith("An error occurred")) window.alert(msg);
        router.refresh();
      }
    });
  };
  // Snapshot per mount — „po terminie” doesn't need to tick.
  const [now] = useState(() => Date.now());

  const renderCell = (c: ColumnModel, t: BoardTableTask) => {
    if (c.custom) {
      return <FieldCell taskId={t.id} columnId={c.custom.id} type={c.custom.type} raw={t.customValues[c.custom.id] ?? ""} options={c.fieldOptions ?? null} disabled={!canEdit} members={members} computed={{ createdAt: t.createdAt, updatedAt: t.updatedAt, autoNumber: t.displayId }} />;
    }
    switch (c.id) {
      case "displayId":
        return <span className="font-mono text-xs text-fg-2">{t.displayId}</span>;
      case "title": {
        const title = titleOverride[t.id] ?? t.title;
        if (editingId === t.id && canEdit) {
          return (
            <input
              autoFocus
              defaultValue={title}
              aria-label="Tytuł zadania"
              maxLength={2000}
              onBlur={(e) => commitTitle(t, e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); commitTitle(t, e.currentTarget.value); }
                else if (e.key === "Escape") { e.preventDefault(); setEditingId(null); }
              }}
              className="h-7 w-full min-w-0 bg-transparent text-sm text-foreground outline-none focus-visible:shadow-none"
            />
          );
        }
        const href = `/w/${workspaceId}/t/${t.id}`;
        return (
          <span className="flex min-w-0 items-center gap-2">
            <Link
              href={href}
              lang="pl"
              className="min-w-0 flex-1 truncate text-sm text-foreground hover:text-foreground hover:underline group-data-[selected]/row:font-medium"
              // No dblclick-disambiguation delay: waiting 220ms before pushing
              // made every task open feel sluggish (AK63). The panel slides in
              // over the right side, so the frozen title cell stays reachable —
              // a second click still enters inline edit below.
              onDoubleClick={(e) => {
                e.preventDefault();
                if (canEdit) setEditingId(t.id);
              }}
            >
              {title}
            </Link>
            <RowHints task={t} />
          </span>
        );
      }
      case "statusColumnId":
        return <StatusPicker taskId={t.id} workspaceId={workspaceId} boardId={boardId} current={statusColumns.find((st) => st.id === t.statusColumnId) ?? null} options={statusColumns} canEdit={canEdit} canManageBoard={canManagePrefs} />;
      case "priority":
        return <PriorityPickerCell taskId={t.id} current={t.priority} canEdit={canEdit} />;
      case "assignees":
        return <AssigneePickerCell taskId={t.id} current={t.assignees} members={members} canEdit={canEdit} />;
      case "tags":
        return <TagPickerCell taskId={t.id} workspaceId={workspaceId} current={t.tags} allTags={allTags} canEdit={canEdit} />;
      case "startAt":
      case "stopAt": {
        const value = c.id === "startAt" ? t.startAt : t.stopAt;
        const overdue = c.id === "stopAt" && value ? new Date(value).getTime() < now : false;
        return (
          <DateTimePicker
            name={c.id}
            defaultValue={value}
            variant="cell"
            format={formatDay}
            placeholder={c.id === "startAt" ? "Data startu" : "Data końca"}
            disabled={!canEdit}
            onChange={(iso) => persistDate(t, c.id as "startAt" | "stopAt", iso)}
            triggerClassName={cn("px-1.5 text-xs text-fg-2 [&_span[role=button]]:hidden hover:[&_span[role=button]]:inline-flex", overdue && "font-medium text-danger-text")}
          />
        );
      }
      case "attachments":
        return <AttachmentCell taskId={t.id} attachments={t.attachments} canEdit={canEdit} />;
      case "milestone":
        return t.milestone ? (
          <span className="inline-flex min-w-0 max-w-full items-center gap-1.5 text-xs text-n-700">
            <IconRoadmap width={10} height={10} className="shrink-0 text-n-500" />
            <span className="truncate">{t.milestone.title}</span>
          </span>
        ) : (
          <span className="text-n-400">—</span>
        );
      default:
        return null;
    }
  };

  const sortLabel = config.sort ? columns.find((c) => sortIdFor(c) === config.sort!.columnId)?.label ?? customColumns.find((c) => c.id === config.sort!.columnId)?.name : null;
  const live = <div aria-live="polite" aria-atomic="true" className="sr-only">{s.live}</div>;
  const bulk = selectedTasks.length > 0 && canEdit && (
    <BulkBar workspaceId={workspaceId} selected={selectedTasks} statusColumns={statusColumns} members={members} allTags={allTags} onClear={() => setSelection({})} />
  );

  if (isMobile) {
    return (
      <div data-ui="list-view" className="-mx-4 -my-4">
        <MobileList
          workspaceId={workspaceId}
          boardId={boardId}
          viewId={viewId}
          groups={groups}
          grouped={Boolean(config.groupBy)}
          collapsed={collapsed}
          onToggleGroup={toggleGroup}
          selection={selection}
          onToggleSelect={toggleSelect}
          statusColumns={statusColumns}
          canEdit={canEdit}
          total={tasks.length}
          formatDay={formatDay}
          now={now}
        />
        {bulk}
        {live}
      </div>
    );
  }

  const cellBase = "h-(--row-h) border-b border-r border-table-grid bg-inherit px-2.5 align-middle outline-none";
  return (
    <div data-ui="list-view" className="-mx-6 -my-4 flex flex-col">
      <div ref={scrollRef} onScroll={onScroll} className="relative min-h-0 overflow-auto" style={{ height: 600 }}>
        <table
          ref={tableRef}
          data-ui="list-table"
          onKeyDown={onKeyDown}
          className="border-separate border-spacing-0 text-sm"
          style={{ tableLayout: "fixed", width: totalWidth, minWidth: "100%" }}
        >
          <colgroup>
            {canEdit && <col style={{ width: CHECKBOX_W }} />}
            {columns.map((c) => <col key={c.id} style={{ width: c.width }} />)}
            {canManagePrefs && <col />}
          </colgroup>
          <thead className="sticky top-0 z-20 bg-table-header">
            <tr className="h-(--table-header-h)">
              {canEdit && (
                <th scope="col" className="sticky left-0 z-30 h-(--table-header-h) border-b border-r border-table-grid bg-table-header p-0 text-center align-middle" title="Klik = wszystkie · Shift+klik w wierszu = zakres">
                  <Checkbox
                    size="sm"
                    ariaLabel="Zaznacz wszystkie wiersze"
                    checked={allChecked}
                    indeterminate={!allChecked && someChecked}
                    onCheckedChange={(next) => setSelection(next ? Object.fromEntries(rows.map((t) => [t.id, true])) : {})}
                  />
                </th>
              )}
              {columns.map((c) => {
                const sortId = sortIdFor(c);
                const isSorted = config.sort?.columnId === sortId ? config.sort.dir : false;
                return (
                  <th
                    key={c.id}
                    scope="col"
                    data-col={c.id}
                    style={{ left: c.pinned ? c.left : undefined }}
                    className={cn(
                      "relative h-(--table-header-h) border-b border-r border-table-grid bg-table-header p-0 text-left align-middle text-2xs font-semibold uppercase tracking-[.06em] whitespace-nowrap text-fg-2",
                      c.pinned && "sticky z-30",
                      c.id === lastPinnedId && "border-r-border",
                      isSorted && "text-foreground",
                    )}
                  >
                    <TableHeaderCell
                      columnId={c.id}
                      label={c.label}
                      icon={c.custom ? <FieldTypeIcon type={c.custom.type} /> : <BuiltinColumnIcon id={c.id} />}
                      canManagePrefs={canManagePrefs}
                      isSorted={isSorted}
                      isPinned={c.pinned}
                      frozen={c.frozen}
                      fieldType={c.custom?.type}
                      fieldOptions={c.fieldOptions}
                      onSort={(dir) => {
                        s.setSort(dir ? { columnId: sortId, kind: sortKindFor(c.id, customColumns), dir } : null);
                        announce(dir ? `Posortowano wg ${c.label} ${dir === "asc" ? "rosnąco" : "malejąco"}` : "Sortowanie wyłączone");
                      }}
                      onFilter={() => {
                        const fc = filterColumnFor(c);
                        if (fc) s.setFilters([...config.filters, newFilter(fc)]);
                        s.setBuilderOpen(true);
                      }}
                      onGroup={() => {
                        const g = groupIdFor(c);
                        if (g) s.setGroupBy(config.groupBy === g ? null : g);
                      }}
                      onHide={() => s.setColumnPrefs({ hidden: [...config.hidden.filter((h) => h !== c.id), c.id] })}
                      onTogglePin={() => s.setColumnPrefs({ pinned: c.pinned ? config.pinned.filter((p) => p !== c.id) : [...config.pinned, c.id] })}
                    />
                    {canManagePrefs && (
                      <div
                        role="separator"
                        aria-orientation="vertical"
                        aria-label="Zmień szerokość kolumny"
                        title="Przeciągnij aby zmienić szerokość · dwuklik = reset"
                        onPointerDown={startResize(c)}
                        onDoubleClick={() => {
                          const { [c.id]: _drop, ...rest } = config.widths;
                          s.setColumnPrefs({ widths: rest });
                        }}
                        className="absolute top-0 right-0 z-10 h-full w-1.5 cursor-col-resize touch-none select-none hover:bg-orange-500 active:bg-orange-500"
                      />
                    )}
                  </th>
                );
              })}
              {canManagePrefs && (
                <th scope="col" className="h-(--table-header-h) border-b border-table-grid bg-table-header p-0 text-left align-middle">
                  <span className="inline-flex h-full items-center px-1.5"><AddColumnButton workspaceId={workspaceId} boardId={boardId} /></span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={colCount} className="border-b border-table-grid py-14 text-center text-sm text-muted-foreground">
                  Brak zadań{activeFilters.length > 0 || deferredSearch ? " — filtry nic nie zwróciły." : "."}
                </td>
              </tr>
            )}
            {padTop > 0 && <tr aria-hidden="true" style={{ height: padTop }}><td colSpan={colCount} className="p-0" /></tr>}
            {items.slice(start, end).map((it) => {
              if (it.kind === "group") {
                const isCollapsed = collapsed.has(it.g.key);
                return (
                  <tr key={`g:${it.g.key}`} data-ui="group-header" className="h-9 bg-canvas">
                    <td colSpan={colCount} className="h-9 border-b border-border p-0 align-middle">
                      <div className="sticky left-0 flex h-full items-center gap-2 px-2.5" style={{ width: viewW }}>
                        <button type="button" aria-expanded={!isCollapsed} aria-label={isCollapsed ? "Rozwiń grupę" : "Zwiń grupę"} onClick={() => toggleGroup(it.g.key)} className="inline-flex size-6 shrink-0 items-center justify-center rounded-sm text-fg-2 outline-none hover:bg-n-100">
                          <IconChevronDown width={12} height={12} className={cn(isCollapsed && "-rotate-90")} />
                        </button>
                        <StatusChip label={it.g.label} hue={it.g.hue} size="md" />
                        <span className="text-xs text-fg-2">
                          {it.g.rows.length} {taskPl(it.g.rows.length)}
                          {isCollapsed && " · zwinięte"}
                        </span>
                        {it.g.sums.length > 0 && (
                          <span className="ml-auto shrink-0 pl-4 font-mono text-2xs text-fg-2">
                            {it.g.sums.map((x) => `Σ ${x.text}`).join(" · ")}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              }
              if (it.kind === "add") {
                return <AddRowInline key="add" workspaceId={workspaceId} boardId={boardId} viewId={viewId} colCount={colCount} width={viewW} />;
              }
              const t = it.t;
              const selected = !!selection[t.id];
              return (
                <tr
                  key={t.id}
                  data-ui="list-row"
                  data-task-id={t.id}
                  data-selected={selected || undefined}
                  className="group/row h-(--row-h) bg-card hover:bg-row-hover data-selected:bg-selected data-selected:shadow-[inset_2px_0_0_var(--orange-500)] data-selected:hover:bg-selected"
                  {...assign.rowProps(t.id, t.assignees.map((a) => a.id))}
                >
                  {canEdit && (
                    <td className={cn(cellBase, "sticky left-0 z-10 px-0 text-center group-data-[selected]/row:shadow-[inset_2px_0_0_var(--orange-500)]")}>
                      <Checkbox size="sm" ariaLabel={`Zaznacz wiersz ${t.title}`} checked={selected} onCheckedChange={() => toggleSelect(t.id, shiftDown.current)} />
                    </td>
                  )}
                  {columns.map((c, ci) => {
                    const isActive = active.row === it.i && active.col === ci;
                    return (
                      <td
                        key={c.id}
                        data-cell=""
                        data-row={it.i}
                        data-col={ci}
                        tabIndex={isActive ? 0 : -1}
                        onFocus={(e) => {
                          if (e.target === e.currentTarget) setActive({ row: it.i, col: ci });
                        }}
                        onDoubleClick={() => {
                          if (c.id === "title" && canEdit) setEditingId(t.id);
                        }}
                        style={{ left: c.pinned ? c.left : undefined }}
                        className={cn(
                          cellBase,
                          "overflow-hidden focus-visible:shadow-[inset_0_0_0_2px_var(--orange-500)]",
                          c.pinned && "sticky z-10",
                          c.id === lastPinnedId && "border-r-border",
                          c.id === "displayId" && "px-2",
                          editingId === t.id && c.id === "title" && "shadow-[inset_0_0_0_2px_var(--orange-500)]",
                        )}
                      >
                        {renderCell(c, t)}
                      </td>
                    );
                  })}
                  {canManagePrefs && <td className={cn(cellBase, "border-r-0")} />}
                </tr>
              );
            })}
            {padBottom > 0 && <tr aria-hidden="true" style={{ height: padBottom }}><td colSpan={colCount} className="p-0" /></tr>}
          </tbody>
        </table>
      </div>
      <div data-ui="list-footer" className="flex h-8 shrink-0 items-center border-t border-border bg-canvas px-6 font-mono text-2xs text-fg-2">
        <span>
          {filteredSorted.length === tasks.length ? `${tasks.length} ${taskPl(tasks.length)}` : `${filteredSorted.length} z ${tasks.length} ${taskPl(tasks.length)}`}
          {selectedCount > 0 && ` · ${selectedCount} ${plPlural(selectedCount, "zaznaczone", "zaznaczone", "zaznaczonych")}`}
        </span>
        <span className="ml-auto text-fg-3">
          gęstość {rowH} px
          {sortLabel && ` · sort: ${sortLabel} ${config.sort?.dir === "asc" ? "↑" : "↓"}`}
          {activeFilters.length > 0 && ` · ${activeFilters.length} ${plPlural(activeFilters.length, "filtr", "filtry", "filtrów")}`}
          {config.groupBy && " · pogrupowane"}
        </span>
      </div>
      {assign.menu}
      {bulk}
      {live}
    </div>
  );
}

// „+ Dodaj zadanie” row — stays in edit mode so the next title can be typed right away.
function AddRowInline({ workspaceId, boardId, viewId, colCount, width }: { workspaceId: string; boardId: string; viewId?: string; colCount: number; width: number }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
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
    if (viewId) fd.set("viewId", viewId);
    setBusy(true);
    startTransition(async () => {
      await createTaskAction(null, fd);
      setTitle("");
      setBusy(false);
    });
  };
  return (
    <tr data-ui="add-row" className="h-9 bg-card">
      <td colSpan={colCount} className="h-9 border-b border-table-grid p-0 align-middle">
        <div className="sticky left-0 flex h-full items-center" style={{ width }}>
          {editing ? (
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => !busy && submit()}
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
              aria-label="Tytuł nowego zadania"
              className="h-7 w-full max-w-[420px] rounded-sm bg-transparent px-2.5 text-sm outline-none placeholder:text-n-400"
              style={{ marginLeft: CHECKBOX_W }}
            />
          ) : (
            <button type="button" onClick={() => setEditing(true)} className="inline-flex h-full items-center gap-1.5 px-2.5 text-sm text-fg-2 outline-none hover:text-foreground" style={{ paddingLeft: CHECKBOX_W + 10 }}>
              <IconPlus width={13} height={13} />
              Dodaj zadanie
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
