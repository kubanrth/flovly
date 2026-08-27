// Pure maths + Polish formatting for E2 „Czas pracy". No React, no Prisma —
// self-check: `npx tsx components/time/time-math.check.ts`.
//
// Every day bucket is a LOCAL calendar day. Millisecond arithmetic is banned
// here: the DST Sunday has 23 or 25 hours, so `start + 86_400_000` lands on the
// wrong date twice a year.

export interface TimeEntryRow {
  id: string;
  userId: string;
  userName: string;
  taskId: string | null;
  taskDisplayId: number | null;
  taskTitle: string | null;
  boardId: string | null;
  boardName: string | null;
  note: string | null;
  /** ISO. The entry belongs to the day it STARTED on, even when it runs past midnight. */
  startedAt: string;
  durationSeconds: number;
  billable: boolean;
  approvedAt: string | null;
}

// ─── dni i tygodnie ─────────────────────────────────────────────────────────

export const WEEKDAYS_LONG = ["poniedziałek", "wtorek", "środa", "czwartek", "piątek", "sobota", "niedziela"];
const MONTHS_GEN = ["stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca", "lipca", "sierpnia", "września", "października", "listopada", "grudnia"];
const MONTHS_ABBR = ["sty", "lut", "mar", "kwi", "maj", "cze", "lip", "sie", "wrz", "paź", "lis", "gru"];

/** Local calendar day, `YYYY-MM-DD`. */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Local Monday 00:00 of `d`'s week. */
export function startOfWeek(d: Date): Date {
  const shift = (d.getDay() + 6) % 7; // Mon = 0
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - shift);
}

/** Seven local midnights, Monday first. Survives DST because each day is built from calendar fields. */
export function weekDays(start: Date): Date[] {
  const mon = startOfWeek(start);
  return Array.from({ length: 7 }, (_, i) => new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + i));
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

/** `?week=YYYY-MM-DD` → Monday of that week; garbage or missing → this week. */
export function parseWeek(input: string | undefined, now: Date): Date {
  if (!input) return startOfWeek(now);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.trim());
  const parsed = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(input);
  return Number.isNaN(parsed.getTime()) ? startOfWeek(now) : startOfWeek(parsed);
}

/** ISO-8601 week number (the week containing that year's first Thursday is week 1). */
export function isoWeek(d: Date): number {
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  t.setDate(t.getDate() + 3 - ((t.getDay() + 6) % 7)); // Thursday of this week
  const firstThursday = new Date(t.getFullYear(), 0, 4);
  firstThursday.setDate(firstThursday.getDate() + 3 - ((firstThursday.getDay() + 6) % 7));
  return 1 + Math.round((t.getTime() - firstThursday.getTime()) / (7 * 86_400_000));
}

/** „25 – 31 sierpnia 2026" / „29 września – 5 października 2026". */
export function weekRangeLabel(days: Date[]): string {
  const a = days[0]!;
  const b = days[days.length - 1]!;
  const tail = `${MONTHS_GEN[b.getMonth()]} ${b.getFullYear()}`;
  if (a.getFullYear() !== b.getFullYear()) {
    return `${a.getDate()} ${MONTHS_GEN[a.getMonth()]} ${a.getFullYear()} – ${b.getDate()} ${tail}`;
  }
  if (a.getMonth() !== b.getMonth()) return `${a.getDate()} ${MONTHS_GEN[a.getMonth()]} – ${b.getDate()} ${tail}`;
  return `${a.getDate()} – ${b.getDate()} ${tail}`;
}

/** Column head: „Pon 25". */
export function dayHead(d: Date): string {
  return `${["Pon", "Wt", "Śr", "Czw", "Pt", "Sob", "Nd"][(d.getDay() + 6) % 7]} ${d.getDate()}`;
}

/** Section head: „wtorek 26 sie". */
export function dayLong(d: Date): string {
  return `${WEEKDAYS_LONG[(d.getDay() + 6) % 7]} ${d.getDate()} ${MONTHS_ABBR[d.getMonth()]}`;
}

// ─── czas ───────────────────────────────────────────────────────────────────

/** „9h 22m" / „11h 00m" / „40m" / „0m". Minutes are zero-padded once hours show. */
export function fmtDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  return h === 0 ? `${m}m` : `${h}h ${String(m).padStart(2, "0")}m`;
}

/** Running timer: „0:42:17". */
export function fmtClock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function pct(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

// ─── siatka osoba × dzień ───────────────────────────────────────────────────

/** Entries of one task (or one bare note) merged into a single 16px chip. */
export interface GridChip {
  key: string;
  /** „#251 Poprawka BLIK · 4h" — task-less entries fall back to the note. */
  label: string;
  seconds: number;
  /** Drives the chip hue; `null` = no board (grey). */
  boardName: string | null;
  taskId: string | null;
}

export interface GridRow {
  personId: string;
  /** One bucket per day of `days`; chips ordered by descending time. */
  cells: GridChip[][];
  daySeconds: number[];
  /** Whole week, including days that are not rendered as columns. */
  total: number;
}

function chipLabel(e: TimeEntryRow): string {
  if (e.taskDisplayId !== null) return `#${e.taskDisplayId} ${e.taskTitle ?? ""}`.trim();
  return e.note?.trim() || "bez zadania";
}

/**
 * Buckets a week of entries into `people × days`. Entries outside `days` still
 * count towards `total` — never silently drop logged time.
 */
export function buildGrid(entries: TimeEntryRow[], days: Date[], personIds: string[]): GridRow[] {
  const index = new Map(days.map((d, i) => [dayKey(d), i]));
  const rows = new Map<string, GridRow>(
    personIds.map((id) => [
      id,
      { personId: id, cells: days.map(() => []), daySeconds: days.map(() => 0), total: 0 },
    ]),
  );
  // Merge key: one chip per task per day; task-less entries merge by their note.
  const merged = new Map<string, GridChip>();

  for (const e of entries) {
    const row = rows.get(e.userId);
    if (!row) continue;
    row.total += e.durationSeconds;
    const i = index.get(dayKey(new Date(e.startedAt)));
    if (i === undefined) continue;
    row.daySeconds[i]! += e.durationSeconds;

    const key = `${e.userId}|${i}|${e.taskId ?? `note:${e.note ?? ""}`}`;
    const chip = merged.get(key);
    if (chip) {
      chip.seconds += e.durationSeconds;
    } else {
      const fresh: GridChip = { key, label: chipLabel(e), seconds: e.durationSeconds, boardName: e.boardName, taskId: e.taskId };
      merged.set(key, fresh);
      row.cells[i]!.push(fresh);
    }
  }

  for (const row of rows.values()) for (const cell of row.cells) cell.sort((a, b) => b.seconds - a.seconds);
  return personIds.map((id) => rows.get(id)!);
}

/**
 * Which day columns to render. Mon–Fri always (makieta E2); a weekend column
 * only joins when somebody logged time on it, so Saturday work is never hidden.
 */
export function visibleDayIndexes(entries: TimeEntryRow[], days: Date[]): number[] {
  const worked = new Set(entries.map((e) => dayKey(new Date(e.startedAt))));
  return days.map((_, i) => i).filter((i) => i < 5 || worked.has(dayKey(days[i]!)));
}

// ─── raport ─────────────────────────────────────────────────────────────────

export interface RollUp {
  key: string;
  label: string;
  seconds: number;
  billableSeconds: number;
}

export function rollUp(
  entries: TimeEntryRow[],
  keyOf: (e: TimeEntryRow) => string | null,
  labelOf: (e: TimeEntryRow) => string,
): RollUp[] {
  const map = new Map<string, RollUp>();
  for (const e of entries) {
    const k = keyOf(e);
    if (k === null) continue;
    const row = map.get(k) ?? { key: k, label: labelOf(e), seconds: 0, billableSeconds: 0 };
    row.seconds += e.durationSeconds;
    if (e.billable) row.billableSeconds += e.durationSeconds;
    map.set(k, row);
  }
  return [...map.values()].sort((a, b) => b.seconds - a.seconds || a.label.localeCompare(b.label, "pl"));
}

export const sumSeconds = (entries: TimeEntryRow[]): number => entries.reduce((n, e) => n + e.durationSeconds, 0);

export const billableSeconds = (entries: TimeEntryRow[]): number =>
  entries.reduce((n, e) => (e.billable ? n + e.durationSeconds : n), 0);

// ─── CSV ────────────────────────────────────────────────────────────────────

const CSV_HEADER = ["data", "osoba", "zadanie", "tablica", "notatka", "godziny", "fakturowane", "zatwierdzone"];

/** Header row + one row per entry, oldest first. Hours use a comma (Excel PL). */
export function csvRows(entries: TimeEntryRow[]): string[][] {
  const sorted = [...entries].sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  return [
    CSV_HEADER,
    ...sorted.map((e) => [
      dayKey(new Date(e.startedAt)),
      e.userName,
      e.taskDisplayId !== null ? `#${e.taskDisplayId} ${e.taskTitle ?? ""}`.trim() : "",
      e.boardName ?? "",
      e.note ?? "",
      (e.durationSeconds / 3600).toFixed(2).replace(".", ","),
      e.billable ? "tak" : "nie",
      e.approvedAt ? dayKey(new Date(e.approvedAt)) : "",
    ]),
  ];
}

/** RFC-4180 quoting; `;` separator so Excel PL opens it without an import wizard. */
export function toCsv(rows: string[][]): string {
  return rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(";")).join("\r\n");
}
