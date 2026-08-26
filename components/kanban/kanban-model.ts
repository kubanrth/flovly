// Pure Kanban (B4) helpers — no React, no DOM. Self-check: `npx tsx components/kanban/kanban-model.check.ts`.

import { PRIORITY_META, PRIORITY_VALUES, type TaskPriorityValue } from "@/lib/task-priority";

export interface KanbanMember {
  id: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
}

export interface KanbanTask {
  id: string;
  displayId: number;
  title: string;
  statusColumnId: string | null;
  rowOrder: number;
  priority: TaskPriorityValue;
  startAt: string | null;
  stopAt: string | null;
  assignees: KanbanMember[];
  tags: { id: string; name: string; colorHex: string }[];
  hasDescription: boolean;
  commentCount: number;
  subtaskCount: number;
  subtaskDoneCount: number;
  linkedCount: number;
  attachmentCount: number;
}

export interface KanbanStatusColumn {
  id: string;
  name: string;
  colorHex: string;
}

// Synthetic column for tasks without a status; persisted back as `null`.
export const NO_STATUS = "__none__";

export const memberLabel = (m: KanbanMember) => m.name ?? m.email;

// ── toolbar state ──────────────────────────────────────────────────────────
export type KanbanGroupBy = "status" | "assignee" | "priority";
export type KanbanSort = "manual" | "priority" | "stopAt" | "title";

export const GROUP_LABEL: Record<KanbanGroupBy, string> = {
  status: "Status",
  assignee: "Przypisany",
  priority: "Priorytet",
};
export const SORT_LABEL: Record<KanbanSort, string> = {
  manual: "Ręcznie",
  priority: "Priorytet",
  stopAt: "Termin",
  title: "Tytuł",
};

// ── filtering / sorting ────────────────────────────────────────────────────

// Matches the title or the `#123` display id; empty query matches everything.
export function matchesQuery(task: KanbanTask, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (task.title.toLowerCase().includes(q)) return true;
  return `#${task.displayId}`.includes(q.startsWith("#") ? q : `#${q}`);
}

export function filterTasks(
  tasks: KanbanTask[],
  f: { query: string; people: string[]; priority: TaskPriorityValue | null },
): KanbanTask[] {
  return tasks.filter((t) => {
    if (!matchesQuery(t, f.query)) return false;
    if (f.people.length > 0 && !t.assignees.some((a) => f.people.includes(a.id))) return false;
    if (f.priority && t.priority !== f.priority) return false;
    return true;
  });
}

// Stable: `manual` keeps rowOrder (the drag order), the rest fall back to it on ties.
export function sortTasks(tasks: KanbanTask[], sort: KanbanSort): KanbanTask[] {
  const byOrder = (a: KanbanTask, b: KanbanTask) => a.rowOrder - b.rowOrder;
  const arr = [...tasks];
  if (sort === "manual") return arr.sort(byOrder);
  return arr.sort((a, b) => {
    if (sort === "priority") {
      const d = PRIORITY_VALUES.indexOf(a.priority) - PRIORITY_VALUES.indexOf(b.priority);
      if (d !== 0) return d;
    } else if (sort === "stopAt") {
      // Undated tasks sink to the bottom.
      const av = a.stopAt ?? "", bv = b.stopAt ?? "";
      if (av !== bv) return av === "" ? 1 : bv === "" ? -1 : av < bv ? -1 : 1;
    } else if (sort === "title") {
      const d = a.title.localeCompare(b.title, "pl");
      if (d !== 0) return d;
    }
    return byOrder(a, b);
  });
}

// ── columns ────────────────────────────────────────────────────────────────

// column id → tasks, in `statusColumns` order; NO_STATUS bucket always exists.
export function columnBuckets(tasks: KanbanTask[], statusColumns: KanbanStatusColumn[], sort: KanbanSort = "manual"): Map<string, KanbanTask[]> {
  const map = new Map<string, KanbanTask[]>();
  for (const c of statusColumns) map.set(c.id, []);
  map.set(NO_STATUS, []);
  for (const t of tasks) map.get(t.statusColumnId ?? NO_STATUS)?.push(t);
  for (const [k, list] of map) map.set(k, sortTasks(list, sort));
  return map;
}

// Rendered column order: real columns, then „Bez statusu” only when it holds tasks.
export function visibleColumnIds(statusColumns: KanbanStatusColumn[], buckets: Map<string, KanbanTask[]>): string[] {
  const ids = statusColumns.map((c) => c.id);
  if ((buckets.get(NO_STATUS)?.length ?? 0) > 0) ids.push(NO_STATUS);
  return ids;
}

// ── WIP limits (localStorage — no StatusColumn.wipLimit in the schema) ──────
export type WipLimits = Record<string, number>;

export function wipTone(count: number, limit: number | null | undefined): "yellow" | "red" | null {
  if (!limit || limit <= 0) return null;
  return count > limit ? "red" : "yellow";
}

// ── dates ──────────────────────────────────────────────────────────────────

// Overdue = the due day is strictly before today (local midnight).
export function isOverdue(stopAt: string | null, now: Date = new Date()): boolean {
  if (!stopAt) return false;
  const due = new Date(stopAt);
  if (Number.isNaN(due.getTime())) return false;
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime() < midnight;
}

// ── swimlanes (B4-swimlane) ────────────────────────────────────────────────

export interface SwimlaneRow {
  key: string;
  label: string;
  // Set for „Przypisany” lanes — the 24px avatar in the 164px gutter.
  avatar?: { name: string; src: string | null };
  count: number;
  cells: Record<string, KanbanTask[]>;
}

// One row per assignee (or priority) × the given columns. Multi-assignee tasks
// show up in every lane they belong to; „Nieprzypisane” lands last.
export function buildSwimlanes(
  tasks: KanbanTask[],
  columnIds: string[],
  groupBy: Exclude<KanbanGroupBy, "status">,
  members: KanbanMember[],
  sort: KanbanSort = "manual",
): SwimlaneRow[] {
  const empty = () => Object.fromEntries(columnIds.map((id) => [id, [] as KanbanTask[]]));
  const rows = new Map<string, SwimlaneRow>();
  const lane = (key: string, label: string, avatar?: SwimlaneRow["avatar"]) => {
    let r = rows.get(key);
    if (!r) {
      r = { key, label, avatar, count: 0, cells: empty() };
      rows.set(key, r);
    }
    return r;
  };
  const put = (r: SwimlaneRow, t: KanbanTask) => {
    const col = t.statusColumnId ?? NO_STATUS;
    if (!r.cells[col]) return;
    r.cells[col].push(t);
    r.count += 1;
  };

  if (groupBy === "assignee") {
    for (const m of members) lane(m.id, memberLabel(m), { name: memberLabel(m), src: m.avatarUrl });
    for (const t of tasks) {
      if (t.assignees.length === 0) put(lane("_none", "Nieprzypisane"), t);
      else for (const a of t.assignees) put(lane(a.id, memberLabel(a), { name: memberLabel(a), src: a.avatarUrl }), t);
    }
  } else {
    const label = (p: TaskPriorityValue) => (p === "NONE" ? "Bez priorytetu" : `${PRIORITY_META[p].shortCode} ${PRIORITY_META[p].label}`);
    for (const p of PRIORITY_VALUES) lane(p, label(p));
    for (const t of tasks) put(lane(t.priority, label(t.priority)), t);
  }

  const out = [...rows.values()].filter((r) => r.count > 0);
  // „Nieprzypisane” after the named lanes.
  out.sort((a, b) => Number(a.key === "_none") - Number(b.key === "_none"));
  for (const r of out) for (const id of columnIds) r.cells[id] = sortTasks(r.cells[id]!, sort);
  return out;
}

export const lanePl = (n: number) => (n === 1 ? "tor" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? "tory" : "torów");
export const columnPl = (n: number) => (n === 1 ? "kolumna" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? "kolumny" : "kolumn");
