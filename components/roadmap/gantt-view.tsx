"use client";

// Oś czasu (B5): left task table 452px (☐ / › / #ID / Tytuł) + right month grid
// with the „Dziś" line, milestone aggregate bars, 20px task bars with date
// handles and TaskLink dependency arrows. Zoom = Tygodnie / Miesiące / Kwartały.
// All date maths lives in timeline-utils.ts (self-checked in timeline-utils.check.ts).

import { startTransition, useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { patchTaskAction } from "@/app/(app)/w/[workspaceId]/t/actions";
import { useWorkspaceRealtime } from "@/hooks/use-workspace-realtime";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { isDoneStatus } from "@/components/profile/dashboard-tiles";
import { plPlural, taskPl } from "@/lib/pluralize";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { StatusChip } from "@/components/ui/chip";
import { CHIP_HUE } from "@/components/ui/chip";
import { hueForColor } from "@/components/ui/status-hue";
import { Tooltip } from "@/components/ui/tooltip";
import { IconChevronDown, IconChevronRight, IconChevronUp, IconInfo, IconPlus, IconRoadmap } from "@/components/ui/icons";
import { useToast } from "@/components/ui/toast";
import { CreateTaskDialog } from "@/components/task/create-task-button";
import {
  GANTT_ZOOMS,
  GANTT_ZOOM_LABEL,
  buildGanttScale,
  formatGanttRange,
  ganttDaysFromPx,
  ganttX,
  shiftIsoDays,
  type GanttScale,
  type GanttZoom,
} from "@/components/roadmap/timeline-utils";
import type { GanttMilestoneItem, GanttTaskItem } from "@/components/gantt/gantt-reads";

export type { GanttMilestoneItem, GanttTaskItem } from "@/components/gantt/gantt-reads";

const LEFT_W = 452;
const ROW_H = 36;
const HEAD_H = 36;
const BAR_H = 20;
const BAR_TOP = 8;
const MIN_BAR_W = 8;
// Mobile B5: 140 (Zadanie, sticky) + 420 (oś) = 560 px of horizontal scroll.
const M_TASK_W = 140;
const M_GRID_W = 420;
const M_ROW_H = 44;
const M_HEAD_H = 32;

const milestonePl = (n: number) => plPlural(n, "milestone", "milestone'y", "milestone'ów");
const todayFmt = new Intl.DateTimeFormat("pl-PL", { weekday: "short", day: "numeric", month: "short", year: "numeric" });

type Row =
  | { kind: "milestone"; id: string; label: string; m: GanttMilestoneItem; done: number; total: number }
  | { kind: "task"; id: string; t: GanttTaskItem; nested: boolean };

interface Box {
  x: number;
  w: number;
  row: number;
}

export function GanttView({
  workspaceId,
  boardId,
  canEdit = false,
  canCreate = false,
  viewId,
  milestones,
  tasks,
}: {
  workspaceId: string;
  boardId: string;
  canEdit?: boolean;
  canCreate?: boolean;
  viewId?: string;
  milestones: GanttMilestoneItem[];
  tasks: GanttTaskItem[];
}) {
  const router = useRouter();
  const toast = useToast();
  const isMobile = useIsMobile();
  useWorkspaceRealtime(workspaceId);

  const [now] = useState(() => Date.now());
  const [zoom, setZoom] = useState<GanttZoom>("weeks");
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [drag, setDrag] = useState<{ id: string; startX: number; days: number } | null>(null);
  const [creating, setCreating] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // ─── rows: milestone (+ its tasks when expanded), then tasks with no milestone
  const rows = useMemo<Row[]>(() => {
    const known = new Set(milestones.map((m) => m.id));
    const grouped = new Map<string, GanttTaskItem[]>();
    const loose: GanttTaskItem[] = [];
    for (const t of tasks) {
      if (t.milestoneId && known.has(t.milestoneId)) {
        const bucket = grouped.get(t.milestoneId);
        if (bucket) bucket.push(t);
        else grouped.set(t.milestoneId, [t]);
      } else loose.push(t);
    }
    const out: Row[] = [];
    milestones.forEach((m, i) => {
      const own = grouped.get(m.id) ?? [];
      out.push({
        kind: "milestone",
        id: m.id,
        label: `M${i + 1}`,
        m,
        done: own.filter((t) => isDoneStatus(t.statusName)).length,
        total: own.length,
      });
      if (expanded.has(m.id)) for (const t of own) out.push({ kind: "task", id: t.id, t, nested: true });
    });
    for (const t of loose) out.push({ kind: "task", id: t.id, t, nested: false });
    return out;
  }, [milestones, tasks, expanded]);

  const scale = useMemo(
    () => buildGanttScale([...milestones, ...tasks], now, zoom, isMobile ? M_GRID_W : undefined),
    [milestones, tasks, now, zoom, isMobile],
  );

  // Bar geometry per row — also feeds the dependency arrows.
  const boxes = useMemo(() => {
    const map = new Map<string, Box>();
    rows.forEach((r, i) => {
      const start = r.kind === "milestone" ? r.m.startAt : r.t.startAt;
      const stop = r.kind === "milestone" ? r.m.stopAt : r.t.stopAt;
      if (!start || !stop) return;
      let stopTs = new Date(stop).getTime();
      if (drag && r.kind === "task" && r.id === drag.id) stopTs += drag.days * 86_400_000;
      const x = ganttX(scale, new Date(start).getTime());
      map.set(r.id, { x, w: Math.max(ganttX(scale, stopTs) - x, MIN_BAR_W), row: i });
    });
    return map;
  }, [rows, scale, drag]);

  const arrows = useMemo(() => {
    const out: { key: string; d: string; head: string }[] = [];
    for (const r of rows) {
      if (r.kind !== "task") continue;
      const from = boxes.get(r.id);
      if (!from) continue;
      for (const targetId of r.t.linksTo) {
        const to = boxes.get(targetId);
        if (!to) continue;
        const sx = from.x + from.w;
        const sy = from.row * ROW_H + ROW_H / 2;
        const tx = to.x;
        const ty = to.row * ROW_H + ROW_H / 2;
        const d =
          tx - 14 > sx
            ? `M${sx} ${sy} H${sx + 10} V${ty} H${tx - 6}`
            : `M${sx} ${sy} H${sx + 10} V${sy + (ty > sy ? ROW_H / 2 : -ROW_H / 2)} H${tx - 16} V${ty} H${tx - 6}`;
        out.push({ key: `${r.id}-${targetId}`, d, head: `M${tx - 6} ${ty - 4} L${tx} ${ty} L${tx - 6} ${ty + 4} Z` });
      }
    }
    return out;
  }, [rows, boxes]);

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const centerToday = useCallback(() => {
    const el = scrollRef.current;
    if (!el || scale.todayX === null) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ left: Math.max(LEFT_W + scale.todayX - el.clientWidth / 2, 0), behavior: reduce ? "auto" : "smooth" });
  }, [scale.todayX]);

  // Land on today the first time the axis is wider than the viewport.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || isMobile || scale.todayX === null) return;
    el.scrollLeft = Math.max(LEFT_W + scale.todayX - el.clientWidth / 2, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, isMobile]);

  // ─── right-handle drag → stopAt ± N days through the existing action ──────
  const onHandleDown = (e: ReactPointerEvent<HTMLElement>, t: GanttTaskItem) => {
    if (!canEdit || !t.startAt || !t.stopAt) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ id: t.id, startX: e.clientX, days: 0 });
  };
  const onHandleMove = (e: ReactPointerEvent<HTMLElement>, t: GanttTaskItem) => {
    if (!drag || drag.id !== t.id || !t.startAt || !t.stopAt) return;
    const span = Math.round((new Date(t.stopAt).getTime() - new Date(t.startAt).getTime()) / 86_400_000);
    const days = Math.max(ganttDaysFromPx(e.clientX - drag.startX, zoom), -span);
    if (days !== drag.days) setDrag({ ...drag, days });
  };
  const commitDays = useCallback(
    (t: GanttTaskItem, days: number) => {
      if (!days || !t.stopAt) return;
      const fd = new FormData();
      fd.set("id", t.id);
      fd.set("stopAt", shiftIsoDays(t.stopAt, days));
      startTransition(async () => {
        try {
          await patchTaskAction(fd);
        } catch (err) {
          toast.add({
            title: "Nie udało się zmienić terminu",
            description: err instanceof Error ? err.message : "Spróbuj ponownie.",
            type: "error",
          });
        }
        router.refresh();
      });
    },
    [router, toast],
  );
  const onHandleUp = (e: ReactPointerEvent<HTMLElement>, t: GanttTaskItem) => {
    if (!drag || drag.id !== t.id) return;
    const { days } = drag;
    e.currentTarget.releasePointerCapture(e.pointerId);
    setDrag(null);
    commitDays(t, days);
  };
  // Keyboard equivalent of the drag handle: ← / → move the deadline by a day
  // (Shift = a week), so the bar is not a mouse-only control.
  const onHandleKey = (e: ReactKeyboardEvent<HTMLElement>, t: GanttTaskItem) => {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    commitDays(t, step * (e.shiftKey ? 7 : 1));
  };

  const allSelected = rows.length > 0 && rows.every((r) => selected[r.id]);
  const bodyH = rows.length * ROW_H;
  const taskCount = tasks.length;

  if (isMobile) {
    return (
      <MobileGantt
        scale={scale}
        rows={rows}
        boxes={boxes}
        zoom={zoom}
        onZoom={setZoom}
        workspaceId={workspaceId}
        now={now}
      />
    );
  }

  return (
    <div data-ui="gantt-view" className="relative -mx-6 -my-4 flex flex-col">
      <div ref={scrollRef} className="relative flex min-h-0 overflow-auto bg-card" style={{ height: 600 }}>
        {/* ── left table ─────────────────────────────────────────────── */}
        <div
          data-ui="gantt-left"
          className="sticky left-0 z-20 flex flex-none flex-col border-r border-border bg-card"
          style={{ width: LEFT_W }}
        >
          <div className="sticky top-0 z-10 flex shrink-0 items-center border-b border-border bg-canvas" style={{ height: HEAD_H }}>
            <span className="flex w-8 items-center justify-center">
              <Checkbox
                size="sm"
                ariaLabel="Zaznacz wszystkie wiersze"
                checked={allSelected}
                indeterminate={!allSelected && rows.some((r) => selected[r.id])}
                onCheckedChange={(next) => setSelected(next ? Object.fromEntries(rows.map((r) => [r.id, true])) : {})}
              />
            </span>
            <span className="w-6" />
            <span className="w-12 text-2xs font-semibold uppercase tracking-[.06em] text-n-600">#ID</span>
            <span className="flex-1 text-2xs font-semibold uppercase tracking-[.06em] text-n-600">Tytuł</span>
          </div>

          {rows.map((r) =>
            r.kind === "milestone" ? (
              <MilestoneRow
                key={r.id}
                row={r}
                open={expanded.has(r.id)}
                checked={!!selected[r.id]}
                onCheck={(v) => setSelected((s) => ({ ...s, [r.id]: v }))}
                onToggle={() => toggle(r.id)}
              />
            ) : (
              <TaskRow
                key={r.id}
                row={r}
                workspaceId={workspaceId}
                checked={!!selected[r.id]}
                onCheck={(v) => setSelected((s) => ({ ...s, [r.id]: v }))}
              />
            ),
          )}

          {canCreate && (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="flex h-9 shrink-0 items-center gap-1.5 px-3 text-sm text-n-600 outline-none hover:bg-row-hover hover:text-foreground active:bg-n-200"
            >
              <IconPlus width={13} height={13} />
              Utwórz zadanie
            </button>
          )}
          <div className="flex-1" />
        </div>

        {/* ── timeline grid ──────────────────────────────────────────── */}
        <div data-ui="gantt-grid" className="relative flex flex-none flex-col" style={{ width: Math.max(scale.width, 320) }}>
          <div className="sticky top-0 z-10 flex shrink-0 border-b border-border bg-canvas" style={{ height: HEAD_H }}>
            {scale.headers.map((h) => (
              <span
                key={h.key}
                className="flex flex-none items-end overflow-hidden whitespace-nowrap border-r border-table-grid px-2 pb-1 text-2xs font-semibold uppercase tracking-[.06em] text-n-600"
                style={{ width: h.w }}
              >
                {h.label}
              </span>
            ))}
            {scale.todayX !== null && (
              <span
                className="pointer-events-none absolute top-[9px] z-[3] inline-flex h-[18px] -translate-x-1/2 items-center rounded-sm bg-orange-500 px-1.5 text-[10px] font-bold text-ink"
                style={{ left: scale.todayX }}
              >
                Dziś
              </span>
            )}
          </div>

          <div className="relative flex-1" style={{ minHeight: bodyH }}>
            {scale.columns.map((c) => (
              <span key={c.key} className="pointer-events-none absolute top-0 bottom-0 w-px bg-table-grid" style={{ left: c.x + c.w }} aria-hidden />
            ))}

            {rows.map((r, i) => (
              <div
                key={r.id}
                className={cn(
                  "absolute inset-x-0 border-b border-table-grid",
                  r.kind === "milestone" && "bg-canvas",
                  selected[r.id] && "bg-selected",
                )}
                style={{ top: i * ROW_H, height: ROW_H }}
              >
                {r.kind === "milestone"
                  ? boxes.get(r.id) && (
                      <span
                        data-ui="gantt-milestone-bar"
                        className="absolute flex items-center overflow-hidden whitespace-nowrap rounded-sm border border-orange-600 bg-orange-100 px-2 text-2xs font-semibold text-orange-800"
                        style={{ left: boxes.get(r.id)!.x, width: boxes.get(r.id)!.w, top: BAR_TOP, height: BAR_H }}
                        title={`${r.label} · ${r.m.title} · ${r.done}/${r.total}`}
                      >
                        {r.label} · {r.m.title} · {r.done}/{r.total}
                      </span>
                    )
                  : boxes.get(r.id) && (
                      <TaskBar
                        task={r.t}
                        box={boxes.get(r.id)!}
                        workspaceId={workspaceId}
                        canEdit={canEdit}
                        dragging={drag?.id === r.id}
                        onDown={onHandleDown}
                        onMove={onHandleMove}
                        onUp={onHandleUp}
                        onKey={onHandleKey}
                      />
                    )}
              </div>
            ))}

            {arrows.length > 0 && (
              <svg
                data-ui="gantt-arrows"
                className="pointer-events-none absolute inset-0"
                width={scale.width}
                height={Math.max(bodyH, 1)}
                fill="none"
                aria-hidden
              >
                {arrows.map((a) => (
                  <g key={a.key}>
                    <path d={a.d} stroke="var(--gantt-dependency)" strokeWidth={1.5} fill="none" />
                    <path d={a.head} fill="var(--gantt-dependency)" />
                  </g>
                ))}
              </svg>
            )}

            {scale.todayX !== null && (
              <span
                data-ui="gantt-today"
                className="pointer-events-none absolute top-0 bottom-0 z-[3] w-[2px] bg-[var(--gantt-today)]"
                style={{ left: scale.todayX }}
                aria-hidden
              />
            )}

            {rows.length === 0 && (
              <p className="absolute inset-x-0 top-24 text-center text-sm text-n-500">
                Brak zadań i milestone&apos;ów z datami. Ustaw Start + Koniec w zadaniu.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── zoom / today control — floats over the bottom-right of the grid ── */}
      <div className="absolute right-4 bottom-11 z-30 flex h-7 items-center gap-2">
        <Tooltip content="Przeciągnij uchwyt paska, aby zmienić termin · romb = milestone">
          <button
            type="button"
            aria-label="Jak działa oś czasu"
            className="inline-flex size-7 items-center justify-center rounded-md border border-border bg-card text-n-600 outline-none hover:bg-n-100 hover:text-foreground active:bg-n-200"
          >
            <IconInfo width={14} height={14} />
          </button>
        </Tooltip>
        <div data-ui="gantt-zoom" role="radiogroup" aria-label="Skala osi czasu" className="inline-flex gap-0.5 rounded-md border border-border bg-card p-0.5 shadow-e1">
          <button
            type="button"
            onClick={centerToday}
            className="inline-flex h-6 items-center rounded-sm border border-transparent px-2.5 text-xs font-medium text-n-600 outline-none hover:bg-n-100 hover:text-foreground active:bg-n-200"
          >
            Dzisiaj
          </button>
          {GANTT_ZOOMS.map((z) => (
            <button
              key={z}
              type="button"
              role="radio"
              aria-checked={zoom === z}
              onClick={() => setZoom(z)}
              className={cn(
                "inline-flex h-6 items-center rounded-sm border px-2.5 text-xs font-medium outline-none active:bg-n-200",
                zoom === z ? "border-border bg-n-100 text-foreground" : "border-transparent text-n-600 hover:bg-n-100 hover:text-foreground",
              )}
            >
              {GANTT_ZOOM_LABEL[z]}
            </button>
          ))}
        </div>
        <button
          type="button"
          aria-label={expanded.size > 0 ? "Zwiń wszystkie milestone'y" : "Rozwiń wszystkie milestone'y"}
          onClick={() => setExpanded(expanded.size > 0 ? new Set() : new Set(milestones.map((m) => m.id)))}
          className="inline-flex size-7 items-center justify-center rounded-md border border-border bg-card text-n-600 outline-none hover:bg-n-100 hover:text-foreground active:bg-n-200"
        >
          {expanded.size > 0 ? <IconChevronUp width={12} height={12} /> : <IconChevronDown width={12} height={12} />}
        </button>
      </div>

      <div data-ui="gantt-footer" className="flex h-8 shrink-0 items-center border-t border-border bg-canvas px-6 font-mono text-2xs text-n-600">
        <span>
          {milestones.length} {milestonePl(milestones.length)} · {expanded.size === 0 ? "zwinięte" : "rozwinięte"} · {taskCount} {taskPl(taskCount)} · zoom: {GANTT_ZOOM_LABEL[zoom].toLowerCase()}
        </span>
        <span className="ml-auto text-n-500">Dziś: {todayFmt.format(new Date(now))}</span>
      </div>

      {canCreate && creating && (
        <CreateTaskDialog workspaceId={workspaceId} boardId={boardId} viewId={viewId} open onOpenChange={setCreating} />
      )}
    </div>
  );
}

// ── left table rows ─────────────────────────────────────────────────────────

function MilestoneRow({
  row,
  open,
  checked,
  onCheck,
  onToggle,
}: {
  row: Extract<Row, { kind: "milestone" }>;
  open: boolean;
  checked: boolean;
  onCheck: (v: boolean) => void;
  onToggle: () => void;
}) {
  const pct = row.total > 0 ? Math.round((row.done / row.total) * 100) : 0;
  return (
    <div
      className={cn("flex shrink-0 items-center border-b border-table-grid bg-canvas", checked && "bg-selected shadow-[inset_2px_0_0_var(--orange-500)]")}
      style={{ height: ROW_H }}
    >
      <span className="flex w-8 items-center justify-center">
        <Checkbox size="sm" ariaLabel={`Zaznacz ${row.m.title}`} checked={checked} onCheckedChange={onCheck} />
      </span>
      <button
        type="button"
        aria-expanded={open}
        aria-label={open ? `Zwiń ${row.m.title}` : `Rozwiń ${row.m.title}`}
        onClick={onToggle}
        className="flex size-6 items-center justify-center rounded-sm text-n-600 outline-none hover:bg-n-200 hover:text-foreground active:bg-n-300"
      >
        <IconChevronRight
          width={12}
          height={12}
          className={cn("transition-transform duration-150 ease-[var(--ease-out)] motion-reduce:transition-none", open && "rotate-90")}
        />
      </button>
      <span className="w-12 font-mono text-xs text-n-600">{row.label}</span>
      <span className="min-w-0 flex-1 pr-2">
        <span className="flex items-center gap-1.5">
          <IconRoadmap width={12} height={12} className="shrink-0 text-orange-700" />
          <span className="truncate text-sm font-semibold">{row.m.title}</span>
          <span className="shrink-0 font-mono text-[10px] text-n-500">
            {row.done}/{row.total} · {formatGanttRange(row.m.startAt, row.m.stopAt)}
          </span>
        </span>
        <span className="mt-[3px] block h-[3px] overflow-hidden rounded-[1.5px] bg-n-200">
          <span className={cn("block h-[3px]", pct >= 60 ? "bg-success" : "bg-info")} style={{ width: `${pct}%` }} />
        </span>
      </span>
    </div>
  );
}

function TaskRow({
  row,
  workspaceId,
  checked,
  onCheck,
}: {
  row: Extract<Row, { kind: "task" }>;
  workspaceId: string;
  checked: boolean;
  onCheck: (v: boolean) => void;
}) {
  const t = row.t;
  const done = isDoneStatus(t.statusName);
  return (
    <div
      className={cn(
        "group/row flex shrink-0 items-center border-b border-table-grid hover:bg-row-hover",
        checked && "bg-selected shadow-[inset_2px_0_0_var(--orange-500)] hover:bg-selected",
      )}
      style={{ height: ROW_H }}
    >
      <span className={cn("flex w-8 items-center justify-center", !checked && "opacity-0 focus-within:opacity-100 group-hover/row:opacity-100")}>
        <Checkbox size="sm" ariaLabel={`Zaznacz ${t.title}`} checked={checked} onCheckedChange={onCheck} />
      </span>
      <span className="w-6" />
      {row.nested && <span className="w-6" />}
      <span className={cn("w-12 font-mono text-xs", done ? "text-n-400 line-through" : "text-n-600")}>{t.displayId}</span>
      <span className="flex min-w-0 flex-1 items-center gap-1.5 pr-2">
        <StatusMark color={t.statusColor} done={done} />
        <Link
          href={`/w/${workspaceId}/t/${t.id}`}
          className={cn("truncate rounded-sm text-sm outline-none hover:text-orange-800 hover:underline", done && "text-n-600")}
        >
          {t.title}
        </Link>
        {t.statusName && <StatusChip label={t.statusName} hue={hueForColor(t.statusColor)} dot={false} size="sm" className="shrink-0" />}
      </span>
    </div>
  );
}

function StatusMark({ color, done }: { color: string; done: boolean }) {
  return (
    <svg width={12} height={12} viewBox="0 0 16 16" fill="none" className="shrink-0" aria-hidden>
      <circle cx="8" cy="8" r="6" stroke={color} strokeWidth={1.4} />
      {done && <path d="M5.4 8.2l1.8 1.8 3.4-4" stroke={color} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  );
}

// ── timeline bar ────────────────────────────────────────────────────────────

function TaskBar({
  task,
  box,
  workspaceId,
  canEdit,
  dragging,
  onDown,
  onMove,
  onUp,
  onKey,
}: {
  task: GanttTaskItem;
  box: Box;
  workspaceId: string;
  canEdit: boolean;
  dragging: boolean;
  onDown: (e: ReactPointerEvent<HTMLElement>, t: GanttTaskItem) => void;
  onMove: (e: ReactPointerEvent<HTMLElement>, t: GanttTaskItem) => void;
  onUp: (e: ReactPointerEvent<HTMLElement>, t: GanttTaskItem) => void;
  onKey: (e: ReactKeyboardEvent<HTMLElement>, t: GanttTaskItem) => void;
}) {
  const hue = hueForColor(task.statusColor);
  return (
    <span className="group/bar absolute" style={{ left: box.x, width: box.w, top: BAR_TOP, height: BAR_H }}>
      <Link
        href={`/w/${workspaceId}/t/${task.id}`}
        data-ui="gantt-bar"
        data-task-id={task.id}
        title={task.title}
        className={cn(
          "flex size-full items-center overflow-hidden whitespace-nowrap rounded-sm border px-2 text-[10px] font-medium outline-none",
          "transition-opacity duration-100 ease-[var(--ease-out)] hover:opacity-80 active:opacity-70 motion-reduce:transition-none",
          CHIP_HUE[hue],
          dragging && "opacity-80",
        )}
        style={{ borderColor: task.statusColor }}
      >
        {task.title}
      </Link>
      {canEdit && (
        <button
          type="button"
          data-ui="gantt-handle-end"
          data-task-id={task.id}
          aria-label={`Przesuń termin zadania „${task.title}" — strzałki zmieniają datę`}
          onPointerDown={(e) => onDown(e, task)}
          onPointerMove={(e) => onMove(e, task)}
          onPointerUp={(e) => onUp(e, task)}
          onPointerCancel={(e) => onUp(e, task)}
          onKeyDown={(e) => onKey(e, task)}
          className={cn(
            "absolute top-0 -right-1 flex h-full w-[10px] cursor-ew-resize items-center justify-center opacity-0 outline-none",
            "group-hover/bar:opacity-100 focus-visible:opacity-100",
            dragging && "opacity-100",
          )}
        >
          <span className="h-4 w-[3px] rounded-[1px]" style={{ background: task.statusColor }} />
        </button>
      )}
    </span>
  );
}

// ── mobile (B5-mobile): 140px sticky task column + 420px axis = 560px ───────

function MobileGantt({
  scale,
  rows,
  boxes,
  zoom,
  onZoom,
  workspaceId,
  now,
}: {
  scale: GanttScale;
  rows: Row[];
  boxes: Map<string, Box>;
  zoom: GanttZoom;
  onZoom: (z: GanttZoom) => void;
  workspaceId: string;
  now: number;
}) {
  const todayLabel = new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "short" }).format(new Date(now));
  return (
    <div data-ui="gantt-view" className="-mx-4 -my-4 flex flex-col">
      <div data-ui="gantt-mobile" className="flex-1 overflow-auto" style={{ maxHeight: "62vh" }}>
        <div style={{ width: M_TASK_W + M_GRID_W }}>
          <div className="sticky top-0 z-10 flex border-b border-border bg-canvas" style={{ height: M_HEAD_H }}>
            <span
              data-ui="gantt-task-col"
              className="sticky left-0 z-20 flex flex-none items-center border-r border-border bg-canvas px-3 text-2xs font-semibold uppercase tracking-[.06em] text-n-600"
              style={{ width: M_TASK_W }}
            >
              Zadanie
            </span>
            {scale.headers.map((h) => (
              <span
                key={h.key}
                className="flex flex-none items-center overflow-hidden whitespace-nowrap border-r border-table-grid px-2 text-2xs font-semibold uppercase tracking-[.06em] text-n-600"
                style={{ width: h.w }}
              >
                {h.label}
              </span>
            ))}
          </div>

          <div className="relative">
            {scale.todayX !== null && (
              <span
                data-ui="gantt-today"
                className="pointer-events-none absolute top-0 bottom-0 z-[1] w-[2px] bg-[var(--gantt-today)]"
                style={{ left: M_TASK_W + scale.todayX }}
                aria-hidden
              />
            )}
            {rows.map((r) => {
              const box = boxes.get(r.id);
              const milestone = r.kind === "milestone";
              return (
                <div key={r.id} className={cn("flex border-b border-table-grid", milestone && "bg-canvas")} style={{ height: M_ROW_H }}>
                  <span
                    className={cn("sticky left-0 z-[2] flex flex-none flex-col justify-center border-r border-border px-3", milestone ? "bg-canvas" : "bg-card")}
                    style={{ width: M_TASK_W }}
                  >
                    {milestone ? (
                      <>
                        <span className="truncate text-xs font-semibold">
                          {r.label} · {r.m.title}
                        </span>
                        <span className="font-mono text-[9px] text-n-500">
                          {r.done}/{r.total}
                        </span>
                      </>
                    ) : (
                      <Link href={`/w/${workspaceId}/t/${r.t.id}`} className="truncate text-xs outline-none hover:text-orange-800">
                        {r.t.title}
                      </Link>
                    )}
                  </span>
                  <span className="relative flex-1">
                    {box && (
                      <span
                        data-ui="gantt-bar"
                        className={cn(
                          "absolute top-3 h-5 rounded-sm border",
                          milestone ? "border-orange-600 bg-orange-100" : CHIP_HUE[hueForColor(r.kind === "task" ? r.t.statusColor : "")],
                        )}
                        style={{
                          left: box.x,
                          width: box.w,
                          borderColor: r.kind === "task" ? r.t.statusColor : undefined,
                        }}
                      />
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        <p className="px-4 py-3 font-mono text-[10px] text-n-500">przewiń poziomo · pomarańczowa linia = dziś ({todayLabel})</p>
      </div>

      <div className="flex shrink-0 justify-center border-t border-border bg-card px-4 py-2.5">
        <div data-ui="gantt-zoom" role="radiogroup" aria-label="Skala osi czasu" className="inline-flex gap-0.5 rounded-md bg-n-100 p-0.5">
          {GANTT_ZOOMS.map((z) => (
            <button
              key={z}
              type="button"
              role="radio"
              aria-checked={zoom === z}
              onClick={() => onZoom(z)}
              className={cn(
                "inline-flex h-8 items-center rounded-sm border px-3.5 text-xs font-medium outline-none active:bg-n-200",
                zoom === z ? "border-border bg-card text-foreground" : "border-transparent text-n-600 hover:text-foreground",
              )}
            >
              {GANTT_ZOOM_LABEL[z]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
