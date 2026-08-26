// Pure maths + Polish formatting for the board Kalendarz (B7). No React, no
// DOM — self-check: `npx tsx components/calendar/calendar.check.ts`.

export interface CalendarTask {
  id: string;
  displayId: number;
  title: string;
  statusId: string | null;
  statusName: string | null;
  statusColor: string | null;
  startAt: string | null; // ISO
  stopAt: string | null; // ISO
  assignees: { id: string; name: string; avatarUrl: string | null }[];
}

export interface CalendarMilestone {
  id: string;
  title: string;
  stopAt: string; // ISO
}

export type PillKind = "start" | "end" | "single";

export interface TaskPill {
  key: string;
  kind: PillKind;
  label: string;
  day: string; // dayKey
  at: number; // ms, sort key within the day
  task: CalendarTask;
}

const MS_DAY = 86_400_000;

/** Local calendar day, `YYYY-MM-DD` (never UTC — a 23:30 CEST deadline is that day). */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function dayKeyOf(iso: string): string {
  return dayKey(new Date(iso));
}

export function parseDayKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}

export function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

/** Whole Monday-first weeks covering `focus`'s month: 28, 35 or 42 cells. */
export function monthGrid(focus: Date): Date[] {
  const y = focus.getFullYear();
  const m = focus.getMonth();
  const offset = (new Date(y, m, 1).getDay() + 6) % 7; // Mon = 0
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const cells = Math.ceil((offset + daysInMonth) / 7) * 7;
  return Array.from({ length: cells }, (_, i) => new Date(y, m, 1 - offset + i));
}

/** One pill per date the task carries; both dates on the same day collapse into one. */
export function taskPills(task: CalendarTask): TaskPill[] {
  const start = task.startAt ? dayKeyOf(task.startAt) : null;
  const stop = task.stopAt ? dayKeyOf(task.stopAt) : null;
  if (start && stop && start !== stop) {
    return [
      { key: `${task.id}:start`, kind: "start", label: `${task.title} — start`, day: start, at: Date.parse(task.startAt!), task },
      { key: `${task.id}:end`, kind: "end", label: `${task.title} — koniec`, day: stop, at: Date.parse(task.stopAt!), task },
    ];
  }
  const iso = task.startAt ?? task.stopAt;
  if (!iso) return [];
  return [{ key: `${task.id}:single`, kind: "single", label: task.title, day: start ?? stop!, at: Date.parse(iso), task }];
}

export function pillsByDay(tasks: CalendarTask[]): Map<string, TaskPill[]> {
  const map = new Map<string, TaskPill[]>();
  for (const task of tasks) {
    for (const pill of taskPills(task)) {
      const bucket = map.get(pill.day);
      if (bucket) bucket.push(pill);
      else map.set(pill.day, [pill]);
    }
  }
  for (const bucket of map.values()) {
    bucket.sort((a, b) => a.at - b.at || a.task.displayId - b.task.displayId);
  }
  return map;
}

/** A cell shows at most `max` items; the rest collapse into „+N więcej". */
export function splitDay<T>(items: T[], max = 3): { visible: T[]; overflow: number } {
  return items.length <= max ? { visible: items, overflow: 0 } : { visible: items.slice(0, max), overflow: items.length - max };
}

/** Distinct tasks with at least one pill inside `focus`'s month. */
export function countTasksInMonth(tasks: CalendarTask[], focus: Date): number {
  const prefix = `${focus.getFullYear()}-${String(focus.getMonth() + 1).padStart(2, "0")}-`;
  let n = 0;
  for (const task of tasks) {
    if (taskPills(task).some((p) => p.day.startsWith(prefix))) n += 1;
  }
  return n;
}

function addDaysIso(iso: string, delta: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + delta);
  return d.toISOString();
}

/**
 * Drag = move the whole task: the dragged pill lands on `targetDay` and the
 * other date shifts by the same number of days, so the span is preserved.
 * Returns only the fields to patch, or null when nothing moves.
 */
export function shiftTaskDates(
  task: CalendarTask,
  kind: PillKind,
  targetDay: string,
): { startAt?: string; stopAt?: string } | null {
  const anchor = kind === "end" ? task.stopAt : (task.startAt ?? task.stopAt);
  if (!anchor) return null;
  const delta = Math.round((parseDayKey(targetDay).getTime() - parseDayKey(dayKeyOf(anchor)).getTime()) / MS_DAY);
  if (delta === 0) return null;
  const patch: { startAt?: string; stopAt?: string } = {};
  if (task.startAt) patch.startAt = addDaysIso(task.startAt, delta);
  if (task.stopAt) patch.stopAt = addDaysIso(task.stopAt, delta);
  return patch;
}

// ─── Polish formatting ──────────────────────────────────────────────────────

export const WEEKDAYS = ["Pon", "Wt", "Śr", "Czw", "Pt", "Sob", "Nd"];
export const WEEKDAY_LETTERS = ["P", "W", "Ś", "C", "P", "S", "N"];

const MONTH_YEAR = new Intl.DateTimeFormat("pl-PL", { month: "long", year: "numeric" });
const SHORT = new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "short" });
const WD_SHORT = new Intl.DateTimeFormat("pl-PL", { weekday: "short", day: "numeric", month: "long" });
const WD_LONG = new Intl.DateTimeFormat("pl-PL", { weekday: "long", day: "numeric", month: "long" });
const LOCATIVE = ["w styczniu", "w lutym", "w marcu", "w kwietniu", "w maju", "w czerwcu", "w lipcu", "w sierpniu", "we wrześniu", "w październiku", "w listopadzie", "w grudniu"];

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** „Wrzesień 2026" */
export const monthTitle = (d: Date) => capitalize(MONTH_YEAR.format(d));
/** „9 wrz" */
export const shortDate = (d: Date) => SHORT.format(d);
/** „Śr, 9 września" */
export const dayTitle = (d: Date) => capitalize(WD_SHORT.format(d).replace(".", ""));
/** „Środa, 9 września" */
export const dayTitleLong = (d: Date) => capitalize(WD_LONG.format(d));
/** „we wrześniu" */
export const monthLocative = (d: Date) => LOCATIVE[d.getMonth()]!;
