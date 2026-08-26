// Shared helpers for any horizontal-time-axis visualisation (roadmap,
// gantt, markers). Factored out of roadmap-view.tsx so the gantt view
// doesn't have to re-derive range / color / row-packing from scratch.

export const DAY_MS = 24 * 60 * 60 * 1000;

// Each entity gets a stable color derived from its id so re-orderings
// don't reshuffle hues across renders.
// Paleta przeniesiona do `lib/colors.ts` (BRAND_PALETTE).
export { TIMELINE_PALETTE } from "@/lib/colors";
import { TIMELINE_PALETTE as PALETTE } from "@/lib/colors";

export function colorFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export interface TimelineItem {
  id: string;
  startAt: string;
  stopAt: string;
}

export interface TimelineRange {
  rangeStart: number;
  rangeStop: number;
  ticks: { ts: number; label: string }[];
}

// Compute axis bounds + month ticks. Given `now` so the caller can make
// this render-pure (Date.now() during React render violates purity).
export function computeTimelineRange<T extends TimelineItem>(
  items: T[],
  now: number,
): TimelineRange {
  if (items.length === 0) {
    return {
      rangeStart: now - 7 * DAY_MS,
      rangeStop: now + 90 * DAY_MS,
      ticks: [],
    };
  }
  let min = Infinity;
  let max = -Infinity;
  for (const m of items) {
    min = Math.min(min, new Date(m.startAt).getTime());
    max = Math.max(max, new Date(m.stopAt).getTime());
  }
  const span = max - min || DAY_MS;
  const pad = span * 0.08;
  const rangeStart = min - pad;
  const rangeStop = max + pad;

  const ticks: { ts: number; label: string }[] = [];
  const d = new Date(rangeStart);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  while (d.getTime() <= rangeStop) {
    ticks.push({
      ts: d.getTime(),
      label: d.toLocaleDateString("pl-PL", { month: "short", year: "2-digit" }),
    });
    d.setMonth(d.getMonth() + 1);
  }
  return { rangeStart, rangeStop, ticks };
}

export function pctFor(ts: number, range: TimelineRange): number {
  return ((ts - range.rangeStart) / (range.rangeStop - range.rangeStart)) * 100;
}

// Greedy row packing — sort items by start, slot each into the first
// track that has no overlap. Produces a Gantt-like stacking.
export function assignRows<T extends TimelineItem>(items: T[]): Map<string, number> {
  const sorted = [...items].sort(
    (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
  );
  const rowEnds: number[] = [];
  const rows = new Map<string, number>();
  for (const m of sorted) {
    const start = new Date(m.startAt).getTime();
    const stop = new Date(m.stopAt).getTime();
    let placed = false;
    for (let i = 0; i < rowEnds.length; i++) {
      if (rowEnds[i] <= start) {
        rowEnds[i] = stop;
        rows.set(m.id, i);
        placed = true;
        break;
      }
    }
    if (!placed) {
      rows.set(m.id, rowEnds.length);
      rowEnds.push(stop);
    }
  }
  return rows;
}

export function formatDateRange(startIso: string, stopIso: string): string {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString("pl-PL", { day: "numeric", month: "short" });
  return `${fmt(startIso)} → ${fmt(stopIso)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Gantt (B5 „Oś czasu") — pure zoom / scale / drag maths.
// Kept here (not in the view) so `timeline-utils.check.ts` can assert it with
// plain node asserts. Everything above stays untouched — roadmap reads it.
// ─────────────────────────────────────────────────────────────────────────────

export const GANTT_ZOOMS = ["weeks", "months", "quarters"] as const;
export type GanttZoom = (typeof GANTT_ZOOMS)[number];

export const GANTT_ZOOM_LABEL: Record<GanttZoom, string> = {
  weeks: "Tygodnie",
  months: "Miesiące",
  quarters: "Kwartały",
};

// px per calendar day and the nominal grid column (1 week / 1 month / 1 quarter).
// weeks: 7 d × 8 px = 56 px column — the width the B5 mockup draws.
const PX_PER_DAY: Record<GanttZoom, number> = { weeks: 8, months: 3, quarters: 1 };
const UNIT_DAYS: Record<GanttZoom, number> = { weeks: 7, months: 30, quarters: 91 };

export function ganttPxPerDay(zoom: GanttZoom): number {
  return PX_PER_DAY[zoom];
}

/** Nominal column width in px: 56 (weeks) / 90 (months) / 91 (quarters). */
export function ganttColumnWidth(zoom: GanttZoom): number {
  return UNIT_DAYS[zoom] * PX_PER_DAY[zoom];
}

/** Inverse used by the bar date handles: horizontal drag → whole days. */
export function ganttDaysFromPx(dx: number, zoom: GanttZoom): number {
  return Math.round(dx / PX_PER_DAY[zoom]);
}

/** `iso` shifted by N days, back as an ISO string (what patchTaskAction parses). */
export function shiftIsoDays(iso: string, days: number): string {
  return new Date(new Date(iso).getTime() + days * DAY_MS).toISOString();
}

export interface GanttBand {
  key: string;
  label: string;
  x: number;
  w: number;
}

export interface GanttScale {
  zoom: GanttZoom;
  originTs: number;
  endTs: number;
  pxPerDay: number;
  width: number;
  /** Vertical grid lines — one per week / month / quarter. */
  columns: GanttBand[];
  /** Top header bands — months (weeks zoom) / quarters / years. */
  headers: GanttBand[];
  /** x of the start of today, or null when today is outside the range. */
  todayX: number | null;
}

function startOfDay(ts: number): Date {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d;
}

function unitStart(ts: number, zoom: GanttZoom): Date {
  const d = startOfDay(ts);
  if (zoom === "weeks") {
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // ISO week — Monday
  } else if (zoom === "months") {
    d.setDate(1);
  } else {
    d.setDate(1);
    d.setMonth(Math.floor(d.getMonth() / 3) * 3);
  }
  return d;
}

function unitStep(d: Date, zoom: GanttZoom, n: number): Date {
  const next = new Date(d);
  if (zoom === "weeks") next.setDate(next.getDate() + 7 * n);
  else if (zoom === "months") next.setMonth(next.getMonth() + n);
  else next.setMonth(next.getMonth() + 3 * n);
  return next;
}

const QUARTER_PL = ["I", "II", "III", "IV"];

function bandStart(ts: number, zoom: GanttZoom): Date {
  const d = startOfDay(ts);
  d.setDate(1);
  if (zoom === "weeks") return d; // month band
  if (zoom === "months") {
    d.setMonth(Math.floor(d.getMonth() / 3) * 3); // quarter band
    return d;
  }
  d.setMonth(0); // year band
  return d;
}

function bandStep(d: Date, zoom: GanttZoom): Date {
  const next = new Date(d);
  if (zoom === "weeks") next.setMonth(next.getMonth() + 1);
  else if (zoom === "months") next.setMonth(next.getMonth() + 3);
  else next.setFullYear(next.getFullYear() + 1);
  return next;
}

function bandLabel(d: Date, zoom: GanttZoom): string {
  if (zoom === "weeks") return d.toLocaleDateString("pl-PL", { month: "long" });
  if (zoom === "months") return `${QUARTER_PL[Math.floor(d.getMonth() / 3)]} kw. ${d.getFullYear()}`;
  return String(d.getFullYear());
}

export function ganttX(scale: Pick<GanttScale, "originTs" | "pxPerDay">, ts: number): number {
  return ((ts - scale.originTs) / DAY_MS) * scale.pxPerDay;
}

/** Inverse of `ganttX`, snapped to a whole day. */
export function ganttTs(scale: Pick<GanttScale, "originTs" | "pxPerDay">, x: number): number {
  return scale.originTs + Math.round(x / scale.pxPerDay) * DAY_MS;
}

/**
 * Axis for the Gantt. Range = every task/milestone date plus `now`, snapped out
 * to whole units with 1 unit of lead-in and 2 of slack (room to drag right).
 * `fitWidth` squeezes the whole range into that many px — the mobile B5 grid,
 * which is a fixed 420 px wide and never scrolls its own axis.
 */
export function buildGanttScale(
  items: { startAt: string | null; stopAt: string | null }[],
  now: number,
  zoom: GanttZoom,
  fitWidth?: number,
): GanttScale {
  let min = now;
  let max = now;
  for (const it of items) {
    for (const iso of [it.startAt, it.stopAt]) {
      if (!iso) continue;
      const t = new Date(iso).getTime();
      if (Number.isNaN(t)) continue;
      if (t < min) min = t;
      if (t > max) max = t;
    }
  }

  const origin = unitStep(unitStart(min, zoom), zoom, -1);
  const end = unitStep(unitStart(max, zoom), zoom, 3);
  const originTs = origin.getTime();
  const endTs = end.getTime();
  const spanDays = (endTs - originTs) / DAY_MS;
  const pxPerDay = fitWidth && spanDays > 0 ? fitWidth / spanDays : PX_PER_DAY[zoom];
  const width = spanDays * pxPerDay;
  const at = (ts: number) => ((ts - originTs) / DAY_MS) * pxPerDay;

  const columns: GanttBand[] = [];
  for (let d = origin; d.getTime() < endTs; d = unitStep(d, zoom, 1)) {
    const next = unitStep(d, zoom, 1);
    const x = at(d.getTime());
    columns.push({ key: String(d.getTime()), label: "", x, w: at(Math.min(next.getTime(), endTs)) - x });
  }

  const headers: GanttBand[] = [];
  for (let d = bandStart(originTs, zoom); d.getTime() < endTs; d = bandStep(d, zoom)) {
    const next = bandStep(d, zoom);
    const x = Math.max(at(d.getTime()), 0);
    const w = Math.min(at(next.getTime()), width) - x;
    if (w > 0) headers.push({ key: String(d.getTime()), label: bandLabel(d, zoom), x, w });
  }

  const todayRaw = at(startOfDay(now).getTime());
  return {
    zoom,
    originTs,
    endTs,
    pxPerDay,
    width,
    columns,
    headers,
    todayX: todayRaw >= 0 && todayRaw <= width ? todayRaw : null,
  };
}

const shortDay = new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "short" });

/** „4 sie – 25 wrz” — the milestone meta line in the B5 left table. */
export function formatGanttRange(startIso: string, stopIso: string): string {
  return `${shortDay.format(new Date(startIso))} – ${shortDay.format(new Date(stopIso))}`;
}
