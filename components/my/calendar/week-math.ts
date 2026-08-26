// Pure maths for the personal calendar week/day grid (D4). No React, no DOM —
// self-check: `npx tsx components/my/calendar/week-math.check.ts`.
// Month maths stays in components/calendar/calendar-math.ts (read-only here).

import { dayKey, dayTitleLong } from "@/components/calendar/calendar-math";

/** First labelled hour of the grid. */
export const DAY_START_HOUR = 8;
/** Last labelled hour (inclusive) — the column keeps rendering rows past it. */
export const DAY_LAST_LABEL_HOUR = 17;
/** End of the positioning window; anything later is pinned to the last row. */
export const DAY_END_HOUR = 20;
export const SLOT_PX = 48;
/** Height of one day column: 12 rows × 48px, exactly as in the mockup. */
export const GRID_PX = (DAY_END_HOUR - DAY_START_HOUR) * SLOT_PX;
/** 08:00 … 17:00 — the labels in the 56px hours column. */
export const HOUR_LABELS = Array.from(
  { length: DAY_LAST_LABEL_HOUR - DAY_START_HOUR + 1 },
  (_, i) => `${String(DAY_START_HOUR + i).padStart(2, "0")}:00`,
);

/** Pill height in the hour grid (mockup: 20px). */
const BLOCK_PX = 20;
/** Vertical gap when two pills would land on top of each other. */
const STACK_GAP = 4;

export type WeekSource = "tasks" | "reminders" | "vacations";

export interface WeekItem {
  key: string;
  source: WeekSource;
  title: string;
  startAt: string | null; // ISO
  stopAt: string | null; // ISO
  href: string | null;
}

export interface TimedBlock {
  key: string;
  source: WeekSource;
  title: string;
  timeLabel: string; // „14:00"
  top: number; // px from the top of the hour grid
  height: number;
  href: string | null;
}

export interface AllDayBlock {
  key: string;
  source: WeekSource;
  label: string; // „Urlop: Gabryś (28–29)" — range suffix only on the first day
  href: string | null;
}

export interface WeekLayout {
  allDay: Map<string, AllDayBlock[]>;
  timed: Map<string, TimedBlock[]>;
  counts: Record<WeekSource, number>;
}

// ─── dates ──────────────────────────────────────────────────────────────────

/** Local midnight `n` days from `d` — DST-safe (no ms arithmetic). */
export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

/** Monday 00:00 of `d`'s week. */
export function startOfWeek(d: Date): Date {
  return addDays(d, -((d.getDay() + 6) % 7));
}

/** Mon → Sun, all at local midnight. */
export function weekDays(anchor: Date): Date[] {
  const monday = startOfWeek(anchor);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/** ISO-8601 week number (Monday-first, week 1 contains 4 January). */
export function isoWeek(d: Date): number {
  const thursday = addDays(d, 3 - ((d.getDay() + 6) % 7));
  const jan4 = new Date(thursday.getFullYear(), 0, 4);
  const firstThursday = addDays(jan4, 3 - ((jan4.getDay() + 6) % 7));
  return 1 + Math.round((thursday.getTime() - firstThursday.getTime()) / 604_800_000);
}

const DAY_MONTH = new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "long" });

/**
 * Header range: „25 – 31 sierpnia 2026", „31 sierpnia – 6 września 2026",
 * „28 grudnia 2026 – 3 stycznia 2027". One day = „Środa, 26 sierpnia 2026".
 */
export function rangeLabel(days: Date[]): string {
  const first = days[0]!;
  const last = days[days.length - 1]!;
  if (days.length === 1) return `${dayTitleLong(first)} ${first.getFullYear()}`;
  if (first.getFullYear() !== last.getFullYear()) {
    return `${DAY_MONTH.format(first)} ${first.getFullYear()} – ${DAY_MONTH.format(last)} ${last.getFullYear()}`;
  }
  if (first.getMonth() !== last.getMonth()) {
    return `${DAY_MONTH.format(first)} – ${DAY_MONTH.format(last)} ${last.getFullYear()}`;
  }
  return `${first.getDate()} – ${DAY_MONTH.format(last)} ${last.getFullYear()}`;
}

// ─── hour grid ──────────────────────────────────────────────────────────────

const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max);

/** Pixels from 08:00; times outside the window pin to the first/last row. */
export function hourOffset(d: Date): number {
  return clamp((d.getHours() + d.getMinutes() / 60 - DAY_START_HOUR) * SLOT_PX, 0, GRID_PX);
}

/** Offset of the „teraz" line, or null when `now` is not inside `day`'s window. */
export function nowOffset(now: Date, day: Date): number | null {
  if (dayKey(now) !== dayKey(day)) return null;
  const raw = (now.getHours() + now.getMinutes() / 60 - DAY_START_HOUR) * SLOT_PX;
  return raw < 0 || raw > GRID_PX ? null : raw;
}

export const timeLabel = (d: Date) =>
  `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

// ─── bucketing ──────────────────────────────────────────────────────────────

/**
 * Splits items into the „cały dzień" row (vacation spans) and the hour grid
 * (task deadlines + reminders), keyed by day. Pills that would overlap are
 * pushed down instead of hidden, so nothing disappears behind a neighbour.
 */
export function layoutWeek(items: WeekItem[], days: Date[]): WeekLayout {
  const inWeek = new Set(days.map(dayKey));
  const allDay = new Map<string, AllDayBlock[]>();
  const timed = new Map<string, TimedBlock[]>();
  const counts: Record<WeekSource, number> = { tasks: 0, reminders: 0, vacations: 0 };

  for (const item of items) {
    if (item.source === "vacations") {
      const from = item.startAt ? new Date(item.startAt) : null;
      const to = item.stopAt ? new Date(item.stopAt) : from;
      if (!from || !to) continue;
      const startKey = dayKey(from);
      const fromMidnight = addDays(from, 0);
      let touched = false;
      // Iterate the week (bounded), not the span — a year-long request must not loop 365×.
      for (const d of days) {
        const key = dayKey(d);
        if (d < fromMidnight || d > to) continue;
        const multi = startKey !== dayKey(to);
        // Range suffix on the first day the span is visible in this week.
        const label = !touched && multi ? `${item.title} (${from.getDate()}–${to.getDate()})` : item.title;
        touched = true;
        const bucket = allDay.get(key) ?? [];
        bucket.push({ key: `${item.key}:${key}`, source: item.source, label, href: item.href });
        allDay.set(key, bucket);
      }
      if (touched) counts.vacations += 1;
      continue;
    }

    const iso = item.stopAt ?? item.startAt;
    if (!iso) continue;
    const at = new Date(iso);
    const key = dayKey(at);
    if (!inWeek.has(key)) continue;
    counts[item.source] += 1;
    const bucket = timed.get(key) ?? [];
    bucket.push({
      key: item.key,
      source: item.source,
      title: item.title,
      timeLabel: timeLabel(at),
      top: hourOffset(at),
      height: BLOCK_PX,
      href: item.href,
    });
    timed.set(key, bucket);
  }

  for (const [key, bucket] of timed) timed.set(key, stack(bucket));
  return { allDay, timed, counts };
}

/** Sorted by time; overlapping pills slide down so every one stays readable. */
function stack(blocks: TimedBlock[]): TimedBlock[] {
  const sorted = [...blocks].sort((a, b) => a.top - b.top || a.key.localeCompare(b.key));
  let floor = 0;
  return sorted.map((b) => {
    const top = clamp(Math.max(b.top, floor), 0, GRID_PX - b.height);
    floor = top + b.height + STACK_GAP;
    return { ...b, top };
  });
}
