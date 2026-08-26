// Pure helpers for „Zadania dla Ciebie” (D2): due-date bucketing, the three
// grouping modes, the row cap behind „Pokaż N kolejnych…” and PL date labels.
// Self-check: `npx tsx components/my-tasks/grouping.check.ts`.
import { PRIORITY_VALUES, PRIORITY_WEIGHT, type TaskPriorityValue } from "@/lib/task-priority";

export type GroupMode = "due" | "board" | "priority";
export type DueBucket = "overdue" | "week" | "later" | "nodate";

// Server-side ordering modes kept from v4 (`?sort=`); when one is active the
// grouping keeps the order the query produced instead of re-sorting.
export type SortMode =
  | "updatedDesc"
  | "updatedAsc"
  | "dueAsc"
  | "dueDesc"
  | "createdAsc"
  | "createdDesc";

export const SORT_LABELS: Record<SortMode, string> = {
  updatedDesc: "ostatnio zmienione",
  updatedAsc: "najdawniej zmienione",
  dueAsc: "termin ↑",
  dueDesc: "termin ↓",
  createdAsc: "najstarsze",
  createdDesc: "najnowsze",
};

export const MODE_LABELS: Record<GroupMode, string> = {
  due: "Wg terminu",
  board: "Wg tablicy",
  priority: "Wg priorytetu",
};

const PRIORITY_GROUP_LABEL: Record<TaskPriorityValue, string> = {
  URGENT: "Pilne",
  HIGH: "Wysoki priorytet",
  MEDIUM: "Średni priorytet",
  LOW: "Niski priorytet",
  NONE: "Bez priorytetu",
};

export interface MyTaskRow {
  id: string;
  displayId: number;
  title: string;
  workspaceId: string;
  boardId: string;
  boardName: string;
  statusName: string | null;
  statusColorHex: string | null;
  priority: TaskPriorityValue;
  stopAt: string | null;
  /** Column the ☐ moves the task into (board's „ukończone” column). */
  doneColumnId: string | null;
  assigneeIds: string[];
}

export interface TaskGroup {
  key: DueBucket | string;
  label: string;
  tone: "danger" | "muted";
  bucket: DueBucket | null;
  rows: MyTaskRow[];
  /** Rows hidden by the cap (sums into „Pokaż N kolejnych…”). */
  hidden: number;
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Monday 00:00 of the week after `d` — the end of „Ten tydzień”. */
export function startOfNextWeek(d: Date): Date {
  const day = (d.getDay() + 6) % 7; // 0 = poniedziałek
  const s = startOfDay(d);
  s.setDate(s.getDate() + (7 - day));
  return s;
}

export function dueBucket(stopAt: string | null, now: Date): DueBucket {
  if (!stopAt) return "nodate";
  const t = new Date(stopAt).getTime();
  if (Number.isNaN(t)) return "nodate";
  if (t < startOfDay(now).getTime()) return "overdue";
  if (t < startOfNextWeek(now).getTime()) return "week";
  return "later";
}

const DUE_ORDER: DueBucket[] = ["overdue", "week", "later", "nodate"];
const DUE_LABEL: Record<DueBucket, string> = {
  overdue: "Po terminie",
  week: "Ten tydzień",
  later: "Później",
  nodate: "Bez terminu",
};

function byDueThenId(a: MyTaskRow, b: MyTaskRow): number {
  const ta = a.stopAt ? new Date(a.stopAt).getTime() : Number.POSITIVE_INFINITY;
  const tb = b.stopAt ? new Date(b.stopAt).getTime() : Number.POSITIVE_INFINITY;
  return ta - tb || a.displayId - b.displayId;
}

export function groupRows(
  rows: MyTaskRow[],
  mode: GroupMode,
  now: Date,
  keepServerOrder = false,
): TaskGroup[] {
  const sort = (list: MyTaskRow[]) => (keepServerOrder ? list : [...list].sort(byDueThenId));

  if (mode === "board") {
    const byBoard = new Map<string, MyTaskRow[]>();
    for (const r of rows) byBoard.set(r.boardId, [...(byBoard.get(r.boardId) ?? []), r]);
    return [...byBoard.entries()]
      .map(([key, list]) => ({
        key,
        label: list[0]!.boardName,
        tone: "muted" as const,
        bucket: null,
        rows: sort(list),
        hidden: 0,
      }))
      .sort((a, b) => a.label.localeCompare(b.label, "pl"));
  }

  if (mode === "priority") {
    return PRIORITY_VALUES.slice()
      .sort((a, b) => PRIORITY_WEIGHT[a] - PRIORITY_WEIGHT[b])
      .map((p) => ({
        key: p,
        label: PRIORITY_GROUP_LABEL[p],
        tone: (p === "URGENT" ? "danger" : "muted") as "danger" | "muted",
        bucket: null,
        rows: sort(rows.filter((r) => r.priority === p)),
        hidden: 0,
      }))
      .filter((g) => g.rows.length > 0);
  }

  const buckets = new Map<DueBucket, MyTaskRow[]>();
  for (const r of rows) {
    const b = dueBucket(r.stopAt, now);
    buckets.set(b, [...(buckets.get(b) ?? []), r]);
  }
  return DUE_ORDER
    // Po terminie / Ten tydzień / Później są stałe (nagłówek zostaje nawet przy
    // zerze); „Bez terminu” dochodzi tylko gdy takie zadania istnieją.
    .filter((b) => b !== "nodate" || (buckets.get(b)?.length ?? 0) > 0)
    .map((b) => ({
      key: b,
      label: DUE_LABEL[b],
      tone: (b === "overdue" ? "danger" : "muted") as "danger" | "muted",
      bucket: b,
      rows: sort(buckets.get(b) ?? []),
      hidden: 0,
    }));
}

/**
 * Cap the number of rendered rows. Every non-empty group keeps at least one
 * row, the rest of the budget is spent in group order — so „Później” never
 * loses its header just because „Po terminie” is long.
 */
export function capGroups(groups: TaskGroup[], limit: number): { groups: TaskGroup[]; hidden: number } {
  const total = groups.reduce((n, g) => n + g.rows.length, 0);
  if (total <= limit) return { groups, hidden: 0 };

  const filled = groups.flatMap((g, i) => (g.rows.length > 0 ? [i] : []));
  let budget = Math.max(limit, filled.length);
  const out = groups.map((g) => ({ ...g }));
  filled.forEach((idx, k) => {
    const g = out[idx]!;
    const reserved = filled.length - 1 - k; // jeden wiersz dla każdej kolejnej grupy
    const take = Math.max(1, Math.min(g.rows.length, budget - reserved));
    budget -= take;
    g.hidden = g.rows.length - take;
    g.rows = g.rows.slice(0, take);
  });
  return { groups: out, hidden: out.reduce((n, g) => n + g.hidden, 0) };
}

/** „25 sie” / „pt 29 sie” (dzień tygodnia tylko w „Ten tydzień”). */
export function formatDue(stopAt: string, bucket: DueBucket): string {
  const d = new Date(stopAt);
  const date = d.toLocaleDateString("pl-PL", { day: "numeric", month: "short" });
  if (bucket !== "week") return date;
  // pl-PL zwraca „sob.” — makieta ma skrót bez kropki.
  const weekday = d.toLocaleDateString("pl-PL", { weekday: "short" }).replace(/\.$/, "");
  return `${weekday} ${date}`;
}

/** „12 otwartych w 3 tablicach” */
export function openSummary(open: number, boards: number): string {
  const otwarte = open === 1 ? "otwarte" : "otwartych";
  return `${open} ${otwarte} w ${boards} ${boards === 1 ? "tablicy" : "tablicach"}`;
}
