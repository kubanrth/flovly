// Roadmapa (B6) — pure derivations: month axis, bar geometry, progress,
// marker size/hue, connector arcs, milestone ordering, description round-trip.
// No React, no DOM. Self-check: `npx tsx components/roadmap/roadmap-model.check.ts`.

/** Month column width on the B6 axis. */
export const MONTH_W = 292;
/** Vertical grid line pitch inside a month column (B6 background). */
export const GRID_W = 72;
/** y of the first marker's dot centre, and the alternating offset below it. */
export const MARKER_TOP = 150;
export const MARKER_STAGGER = 44;

export interface Span {
  startAt: string;
  stopAt: string;
}

export interface MonthColumn {
  ts: number;
  label: string;
}

function monthStart(ts: number): Date {
  const d = new Date(ts);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function monthLabel(d: Date): string {
  return d.toLocaleDateString("pl-PL", { month: "long" });
}

/**
 * Month columns covering every span plus today (the „Dziś" line always has a
 * place on the axis). Never fewer than two columns, so an empty roadmap still
 * draws a grid.
 */
export function monthColumns(spans: Span[], now: number): MonthColumn[] {
  let min = now;
  let max = now;
  for (const s of spans) {
    for (const iso of [s.startAt, s.stopAt]) {
      const t = new Date(iso).getTime();
      if (Number.isNaN(t)) continue;
      if (t < min) min = t;
      if (t > max) max = t;
    }
  }
  const out: MonthColumn[] = [];
  const d = monthStart(min);
  const last = monthStart(max).getTime();
  while (d.getTime() <= last || out.length < 2) {
    out.push({ ts: d.getTime(), label: monthLabel(d) });
    d.setMonth(d.getMonth() + 1);
  }
  return out;
}

/** Total axis width in px. */
export function axisWidth(months: MonthColumn[]): number {
  return months.length * MONTH_W;
}

/** Timestamp → px on the axis, clamped to the drawn range. */
export function xForTs(ts: number, months: MonthColumn[]): number {
  if (months.length === 0 || !Number.isFinite(ts)) return 0;
  const total = axisWidth(months);
  let i = 0;
  for (let k = months.length - 1; k > 0; k--) {
    if (ts >= months[k]!.ts) {
      i = k;
      break;
    }
  }
  const start = months[i]!.ts;
  const next = new Date(start);
  next.setMonth(next.getMonth() + 1);
  const frac = (ts - start) / (next.getTime() - start);
  return Math.max(0, Math.min(total, (i + frac) * MONTH_W));
}

/** Bar offset/width in px for a date span, never thinner than `minWidth`. */
export function spanX(
  startAt: string,
  stopAt: string,
  months: MonthColumn[],
  minWidth = 0,
): { left: number; width: number } {
  const left = xForTs(new Date(startAt).getTime(), months);
  const right = xForTs(new Date(stopAt).getTime(), months);
  return { left, width: Math.max(right - left, minWidth) };
}

/**
 * Which status columns count as „done". Board schema has no `isDone` flag, so:
 * every column whose name reads as done, else the last column by order (the
 * terminal Kanban column).
 * ponytail: swap for a real `StatusColumn.isDone` if one ever lands.
 */
const DONE_NAME =
  /^(done|gotowe|gotowy|gotów|zrobione|zakończone|ukończone|closed|zamknięte|complete|completed)$/i;

export function doneStatusIds(
  columns: { id: string; name: string; order: number }[],
): Set<string> {
  const named = columns.filter((c) => DONE_NAME.test(c.name.trim()));
  if (named.length > 0) return new Set(named.map((c) => c.id));
  const last = [...columns].sort((a, b) => a.order - b.order).at(-1);
  return new Set(last ? [last.id] : []);
}

export interface Progress {
  done: number;
  total: number;
  pct: number;
}

export function progressOf(
  tasks: { statusColumnId?: string | null }[],
  done: Set<string>,
): Progress {
  const total = tasks.length;
  let d = 0;
  for (const t of tasks) if (t.statusColumnId && done.has(t.statusColumnId)) d++;
  return { done: d, total, pct: total === 0 ? 0 : Math.round((d / total) * 100) };
}

export type MarkerHue = "gray" | "blue" | "green";

/** Marker colour follows progress: nothing done → grey, started → blue, half-way+ → green. */
export function markerHue(pct: number): MarkerHue {
  if (pct <= 0) return "gray";
  return pct < 50 ? "blue" : "green";
}

/** Dot diameter grows with the task count — 40/44/48/52 as drawn in B6-markery. */
export function markerSize(taskCount: number): number {
  if (taskCount >= 10) return 52;
  if (taskCount >= 8) return 48;
  if (taskCount >= 5) return 44;
  return 40;
}

export function markerFontSize(diameter: number): number {
  return diameter >= 52 ? 15 : 14;
}

/** Reading order of the roadmap: by start date, then end date, then title. */
export function sortMilestones<T extends Span & { title: string }>(items: T[]): T[] {
  return [...items].sort(
    (a, b) =>
      new Date(a.startAt).getTime() - new Date(b.startAt).getTime() ||
      new Date(a.stopAt).getTime() - new Date(b.stopAt).getTime() ||
      a.title.localeCompare(b.title, "pl"),
  );
}

export const milestoneLabel = (index: number) => `M${index + 1}`;

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Dashed connector between two markers. `bulge` is the vertical bow (negative
 * arcs over the gap, positive under it) — alternated by the caller so the chain
 * reads as a wave like the mockup.
 */
export function arcPath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  bulge: number,
): string {
  const dx = x2 - x1;
  return `M ${r2(x1)} ${r2(y1)} C ${r2(x1 + dx / 3)} ${r2(y1 + bulge)}, ${r2(x1 + (dx * 2) / 3)} ${r2(y2 + bulge)}, ${r2(x2)} ${r2(y2)}`;
}

/** Tangent of `arcPath` at its end point, in radians — orients the arrow head. */
export function arcAngle(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  bulge: number,
): number {
  const dx = x2 - x1;
  return Math.atan2(y2 - (y2 + bulge), x2 - (x1 + (dx * 2) / 3));
}

/** Filled triangle at (x, y) pointing along `angle`. */
export function arrowHead(x: number, y: number, angle: number, size = 6): string {
  const p = (turn: number) =>
    `${r2(x + Math.cos(angle + turn) * size)} ${r2(y + Math.sin(angle + turn) * size)}`;
  return `M ${r2(x)} ${r2(y)} L ${p(Math.PI - 0.42)} L ${p(Math.PI + 0.42)} Z`;
}

// ── Opis ⇄ ProseMirror ───────────────────────────────────────────────────────
// The milestone description is stored as a Tiptap doc, but B6 edits it as plain
// text, so the dialog converts both ways.

export function docToText(doc: unknown): string {
  if (!doc || typeof doc !== "object") return "";
  const blocks = (doc as { content?: unknown[] }).content ?? [];
  return blocks.map(nodeText).join("\n").trim();
}

function nodeText(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const n = node as { type?: string; text?: string; content?: unknown[] };
  if (n.type === "text") return n.text ?? "";
  return (n.content ?? []).map(nodeText).join("");
}

/** Plain text → the JSON string `createMilestoneSchema` expects (empty = clear). */
export function textToDoc(text: string): string {
  const t = text.replace(/\r\n/g, "\n").trim();
  if (t === "") return "";
  return JSON.stringify({
    type: "doc",
    content: t
      .split("\n")
      .map((line) =>
        line === ""
          ? { type: "paragraph" }
          : { type: "paragraph", content: [{ type: "text", text: line }] },
      ),
  });
}
