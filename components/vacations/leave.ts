// Pure date/limit helpers for E4 „Urlopy”. No React, no Prisma — every branch
// is covered by `npx tsx components/vacations/leave.check.ts`.

/** Kodeks pracy art. 154 §1 pkt 2 — 26 dni po 10 latach stażu. */
export const ANNUAL_LEAVE_DAYS = 26;

const MS_DAY = 86_400_000;

/** Days since the epoch, UTC-normalised — safe for inclusive range maths. */
export function dayIndex(iso: string): number {
  const d = new Date(iso);
  return Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / MS_DAY);
}

export interface DateRange {
  startDate: string;
  endDate: string;
}

/**
 * Inclusive overlap. Ranges that only touch (a ends the day before b starts)
 * do NOT overlap — two people back-to-back is not a conflict.
 */
export function overlaps(a: DateRange, b: DateRange): boolean {
  return dayIndex(a.startDate) <= dayIndex(b.endDate) && dayIndex(b.startDate) <= dayIndex(a.endDate);
}

/** Mon–Fri days in an inclusive range. Single weekday = 1, single Saturday = 0. */
export function workingDays(range: DateRange): number {
  const start = dayIndex(range.startDate);
  const end = dayIndex(range.endDate);
  if (end < start) return 0;
  let n = 0;
  for (let d = start; d <= end; d++) {
    // Day 0 (1970-01-01) was a Thursday, so (d + 4) mod 7 → 0 = Sunday, 6 = Saturday.
    const dow = (((d + 4) % 7) + 7) % 7;
    if (dow !== 0 && dow !== 6) n++;
  }
  return n;
}

/** Leave days already booked (sum of working days) — drives the limit tile. */
export function usedDays(ranges: DateRange[]): number {
  return ranges.reduce((n, r) => n + workingDays(r), 0);
}

/** Never negative: over-booked leave shows „0 dni”, not a minus. */
export function remainingDays(used: number, limit: number = ANNUAL_LEAVE_DAYS): number {
  return Math.max(0, limit - used);
}

export interface MonthSpan {
  /** 1-based day of month, clamped to the month. */
  startDay: number;
  endDay: number;
}

/** Clamp a range to `year`/`month` (0-based) → 1-based days, or null when it misses the month. */
export function monthSpan(range: DateRange, year: number, month: number): MonthSpan | null {
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const first = Math.floor(Date.UTC(year, month, 1) / MS_DAY);
  const start = dayIndex(range.startDate) - first + 1;
  const end = dayIndex(range.endDate) - first + 1;
  if (end < 1 || start > days) return null;
  return { startDay: Math.max(1, start), endDay: Math.min(days, end) };
}

/** Is `iso` inside the (inclusive) range? Used by „Nieobecni dziś”. */
export function coversDay(range: DateRange, iso: string): boolean {
  const d = dayIndex(iso);
  return dayIndex(range.startDate) <= d && d <= dayIndex(range.endDate);
}
