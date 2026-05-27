"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import {
  assignTaskToMilestoneAction,
  deleteMilestoneAction,
} from "@/app/(app)/w/[workspaceId]/b/[boardId]/milestone-actions";
import { MilestoneDialog, type MilestoneMember } from "@/components/roadmap/milestone-dialog";
import {
  assignRows,
  colorFor,
  computeTimelineRange,
  formatDateRange,
  pctFor,
} from "@/components/roadmap/timeline-utils";
import { plPlural, taskPl } from "@/lib/pluralize";

export interface MilestoneItem {
  id: string;
  title: string;
  startAt: string;
  stopAt: string;
  assignee: MilestoneMember | null;
  taskCount: number;
  tasks: { id: string; title: string }[];
}

const ROW_HEIGHT = 36;
const TRACK_PADDING_Y = 18;

type Mode = "timeline" | "markers";

export function RoadmapView({
  workspaceId,
  boardId,
  members,
  milestones,
  canCreate,
  canUpdate,
  canDelete,
  initialMode = "timeline",
}: {
  workspaceId: string;
  boardId: string;
  members: MilestoneMember[];
  milestones: MilestoneItem[];
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  initialMode?: Mode;
}) {
  // Timeline mode removed (gantt view replaces it); state kept in case it returns.
  const [mode] = useState<Mode>("markers");
  const _initialMode = initialMode;
  void _initialMode;
  const [dialog, setDialog] = useState<
    | { mode: "create" }
    | { mode: "edit"; milestone: MilestoneItem }
    | null
  >(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  // Stable "now" captured once at mount; avoids Date.now() during render,
  // which triggers react-hooks/purity. The "today" marker doesn't need to
  // tick live — a refresh is fine.
  const [now] = useState(() => Date.now());

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const range = useMemo(() => computeTimelineRange(milestones, now), [milestones, now]);
  const rowMap = useMemo(() => assignRows(milestones), [milestones]);
  const rowCount = Math.max(1, ...[...rowMap.values()].map((n) => n + 1));
  const chartHeight = rowCount * ROW_HEIGHT + 2 * TRACK_PADDING_Y;

  const todayInRange = now >= range.rangeStart && now <= range.rangeStop;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted-foreground">
            {milestones.length} {plPlural(milestones.length, "milestone", "milestone’y", "milestone’ów")}
          </span>
          {/* F11-7: tryb "Oś czasu" usunięty — Gantt to robi. Zostaje tylko
              "Wizualizacja" jako default; mode toggle ukryty. */}
        </div>
        {canCreate && (
          <button
            type="button"
            onClick={() => setDialog({ mode: "create" })}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-gradient px-4 font-sans text-[0.85rem] font-semibold text-white shadow-brand transition-[transform,opacity] duration-200 hover:-translate-y-[1px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <Plus size={14} /> Nowy milestone
          </button>
        )}
      </div>

      {/* Chart */}
      <div className="rounded-xl border border-border bg-card/70 p-4 shadow-sm backdrop-blur">
        {/* Time axis */}
        <div className="relative mb-3 h-5 border-b border-border">
          {range.ticks.map((t) => (
            <div
              key={t.ts}
              className="absolute -top-0.5 flex -translate-x-1/2 flex-col items-center"
              style={{ left: `${pctFor(t.ts, range)}%` }}
            >
              <span className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground/80">
                {t.label}
              </span>
            </div>
          ))}
        </div>

        {mode === "timeline" ? (
          <TimelineTrack
            range={range}
            milestones={milestones}
            rowMap={rowMap}
            chartHeight={chartHeight}
            todayInRange={todayInRange}
            now={now}
            canUpdate={canUpdate}
            onEdit={(m) => setDialog({ mode: "edit", milestone: m })}
          />
        ) : (
          <MarkersTrack
            range={range}
            milestones={milestones}
            todayInRange={todayInRange}
            now={now}
            canUpdate={canUpdate}
            onEdit={(m) => setDialog({ mode: "edit", milestone: m })}
          />
        )}
      </div>

      {/* Per-milestone card list with expandable tasks */}
      {milestones.length > 0 && (
        <ul className="flex flex-col gap-2">
          {milestones.map((m) => {
            const isOpen = expanded.has(m.id);
            const color = colorFor(m.id);
            return (
              <li
                key={m.id}
                className="overflow-hidden rounded-lg border border-border bg-card"
              >
                <div className="flex items-center gap-3 px-4 py-3">
                  <span
                    className="h-6 w-1.5 shrink-0 rounded-full"
                    style={{ background: color }}
                    aria-hidden
                  />
                  <button
                    type="button"
                    onClick={() => toggle(m.id)}
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    aria-label={isOpen ? "Zwiń" : "Rozwiń"}
                    aria-expanded={isOpen}
                  >
                    {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-display text-[0.98rem] font-semibold tracking-[-0.01em]">
                      {m.title}
                    </span>
                    <span className="font-mono text-[0.64rem] uppercase tracking-[0.12em] text-muted-foreground">
                      {formatDateRange(m.startAt, m.stopAt)} · {m.taskCount}{" "}
                      {taskPl(m.taskCount)}
                    </span>
                  </div>
                  {m.assignee && (
                    <span
                      className="grid h-6 w-6 shrink-0 place-items-center overflow-hidden rounded-full bg-brand-gradient font-display text-[0.58rem] font-bold text-white"
                      title={m.assignee.name ?? m.assignee.email}
                    >
                      {(m.assignee.name ?? m.assignee.email).slice(0, 2).toUpperCase()}
                    </span>
                  )}
                  {canUpdate && (
                    <button
                      type="button"
                      onClick={() => setDialog({ mode: "edit", milestone: m })}
                      aria-label="Edytuj"
                      title="Edytuj"
                      className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      <Pencil size={13} />
                    </button>
                  )}
                  {canDelete && (
                    <form action={deleteMilestoneAction} className="m-0">
                      <input type="hidden" name="id" value={m.id} />
                      <button
                        type="submit"
                        aria-label="Usuń"
                        title="Usuń"
                        className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 size={13} />
                      </button>
                    </form>
                  )}
                </div>
                {isOpen && (
                  <div className="border-t border-border bg-muted/20 px-4 py-3">
                    {m.tasks.length === 0 ? (
                      <p className="text-[0.86rem] text-muted-foreground">
                        Brak zadań w tym milestone.
                      </p>
                    ) : (
                      <ul className="flex flex-col gap-1">
                        {m.tasks.map((t) => (
                          <li
                            key={t.id}
                            className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-[0.88rem] transition-colors hover:bg-accent/60"
                          >
                            <Link
                              href={`/w/${workspaceId}/t/${t.id}`}
                              className="min-w-0 flex-1 truncate focus-visible:outline-none"
                            >
                              {t.title}
                            </Link>
                            <form action={assignTaskToMilestoneAction} className="m-0">
                              <input type="hidden" name="taskId" value={t.id} />
                              <input type="hidden" name="milestoneId" value="" />
                              <button
                                type="submit"
                                className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-destructive"
                                title="Odczep zadanie"
                              >
                                Odczep
                              </button>
                            </form>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {dialog && (
        <MilestoneDialog
          workspaceId={workspaceId}
          boardId={boardId}
          members={members}
          mode={dialog.mode}
          initial={dialog.mode === "edit" ? dialog.milestone : null}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}

function TimelineTrack({
  range,
  milestones,
  rowMap,
  chartHeight,
  todayInRange,
  now,
  canUpdate,
  onEdit,
}: {
  range: ReturnType<typeof computeTimelineRange>;
  milestones: MilestoneItem[];
  rowMap: Map<string, number>;
  chartHeight: number;
  todayInRange: boolean;
  now: number;
  canUpdate: boolean;
  onEdit: (m: MilestoneItem) => void;
}) {
  return (
    <div
      className="relative w-full"
      style={{ height: chartHeight, paddingTop: TRACK_PADDING_Y, paddingBottom: TRACK_PADDING_Y }}
    >
      {range.ticks.map((t) => (
        <div
          key={t.ts}
          className="pointer-events-none absolute top-0 bottom-0 w-px bg-border/60"
          style={{ left: `${pctFor(t.ts, range)}%` }}
          aria-hidden
        />
      ))}

      {todayInRange && (
        <>
          <div
            className="pointer-events-none absolute top-0 bottom-0 w-[2px] bg-primary/60"
            style={{ left: `${pctFor(now, range)}%` }}
            aria-hidden
          />
          <span
            className="pointer-events-none absolute -top-2 -translate-x-1/2 rounded-full bg-primary px-1.5 font-mono text-[0.56rem] font-semibold uppercase tracking-[0.14em] text-primary-foreground"
            style={{ left: `${pctFor(now, range)}%` }}
          >
            Dziś
          </span>
        </>
      )}

      {milestones.map((m) => {
        const row = rowMap.get(m.id) ?? 0;
        const start = new Date(m.startAt).getTime();
        const stop = new Date(m.stopAt).getTime();
        const left = pctFor(start, range);
        const width = Math.max(pctFor(stop, range) - left, 0.8);
        const color = colorFor(m.id);
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => canUpdate && onEdit(m)}
            disabled={!canUpdate}
            className="group absolute flex items-center gap-2 rounded-md px-2 py-1 text-left text-[0.78rem] font-medium text-white shadow-[0_1px_2px_rgba(0,0,0,0.12)] transition-[transform,opacity] duration-200 hover:-translate-y-[1px] disabled:cursor-default"
            style={{
              top: TRACK_PADDING_Y + row * ROW_HEIGHT,
              left: `${left}%`,
              width: `${width}%`,
              height: ROW_HEIGHT - 8,
              background: `linear-gradient(135deg, ${color}, color-mix(in oklch, ${color} 70%, white))`,
            }}
            title={`${m.title} · ${formatDateRange(m.startAt, m.stopAt)}`}
          >
            <span className="truncate">{m.title}</span>
            <span className="shrink-0 rounded-full bg-white/25 px-1.5 font-mono text-[0.58rem] font-bold">
              {m.taskCount}
            </span>
          </button>
        );
      })}

      {milestones.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="font-display text-[0.92rem] text-muted-foreground">
            Brak milestones. Dodaj pierwszy, żeby narysować oś czasu.
          </p>
        </div>
      )}
    </div>
  );
}

// "Wizualizacja" — flow-chart layout bez osi czasu. Milestones
// idą chronologicznie w rzędzie z połączeniami strzałkowymi między
// nimi. Pod każdą kropką: tytuł milestone + button "Sprawdź zadania"
// prowadzący do listy zadań tego milestone'u (/t/[taskId] dla każdego
// przypisanego zadania — tu expand inline).
function MarkersTrack({
  milestones,
  canUpdate,
  onEdit,
}: {
  range: ReturnType<typeof computeTimelineRange>;
  milestones: MilestoneItem[];
  todayInRange: boolean;
  now: number;
  canUpdate: boolean;
  onEdit: (m: MilestoneItem) => void;
}) {
  const sorted = useMemo(
    () =>
      [...milestones].sort(
        (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
      ),
    [milestones],
  );

  if (sorted.length === 0) {
    return (
      <div className="flex h-[120px] items-center justify-center">
        <p className="font-display text-[0.92rem] text-muted-foreground">
          Brak milestones. Dodaj pierwszy, żeby zobaczyć wizualizację.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto py-2">
      <div className="flex min-w-min items-start gap-0">
        {sorted.map((m, i) => {
          const color = colorFor(m.id);
          const isLast = i === sorted.length - 1;
          return (
            <div key={m.id} className="flex items-start">
              <MilestoneNode
                milestone={m}
                color={color}
                canUpdate={canUpdate}
                onEdit={onEdit}
              />
              {!isLast && <FlowArrow />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MilestoneNode({
  milestone,
  color,
  canUpdate,
  onEdit,
}: {
  milestone: MilestoneItem;
  color: string;
  canUpdate: boolean;
  onEdit: (m: MilestoneItem) => void;
}) {
  const [showTasks, setShowTasks] = useState(false);
  const params = useParams<{ workspaceId?: string }>();
  const workspaceId = params?.workspaceId ?? "";
  return (
    <div className="flex w-[180px] shrink-0 flex-col items-center gap-2 px-2">
      {/* F11-2 (#8): title block fixed-height — wcześniej min-h pozwalało
          rosnąć przy 2 liniach, przez co dot przesuwał się w dół a strzałka
          (paddingTop fixed) zostawała w starym miejscu → rozjazd. */}
      <div className="flex h-[44px] flex-col items-center justify-center gap-0.5 overflow-hidden text-center">
        <span className="font-display text-[0.92rem] font-semibold leading-tight tracking-[-0.01em] line-clamp-2">
          {milestone.title}
        </span>
        <span className="font-mono text-[0.56rem] uppercase tracking-[0.12em] text-muted-foreground">
          {milestone.taskCount} {taskPl(milestone.taskCount)}
        </span>
      </div>

      {/* The dot (= button edit jak poprzednio) */}
      <button
        type="button"
        onClick={() => canUpdate && onEdit(milestone)}
        disabled={!canUpdate}
        aria-label={`${milestone.title}, edytuj`}
        title={milestone.title}
        className="grid h-12 w-12 place-items-center rounded-full text-white shadow-[0_4px_10px_rgba(0,0,0,0.15)] transition-transform duration-150 hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-default"
        style={{
          background: `linear-gradient(135deg, ${color}, color-mix(in oklch, ${color} 70%, white))`,
        }}
      >
        <span className="font-mono text-[0.82rem] font-bold">{milestone.taskCount}</span>
      </button>

      {/* "Sprawdź zadania" button below */}
      {milestone.tasks.length > 0 && (
        <button
          type="button"
          onClick={() => setShowTasks((v) => !v)}
          className="inline-flex h-7 items-center gap-1 rounded-full border border-border bg-card px-3 font-mono text-[0.58rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
        >
          {showTasks ? "Ukryj zadania" : "Sprawdź zadania"}
        </button>
      )}

      {showTasks && milestone.tasks.length > 0 && (
        <ul className="w-full rounded-md border border-border bg-card p-1 text-[0.76rem]">
          {milestone.tasks.map((t) => (
            <li key={t.id}>
              <Link
                href={`/w/${workspaceId}/t/${t.id}`}
                className="block truncate rounded-sm px-2 py-1 transition-colors hover:bg-accent"
                title={t.title}
              >
                {t.title}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Flow arrow between two milestone nodes — simple SVG chevron at node-
// center-height so cała linia łączy je ładnie.
function FlowArrow() {
  // Arrow Y-center pinned to dot center.
  // dot center = 44 (title block) + 8 (gap-2) + 24 (half of h-12 dot) = 76px.
  // svg is 24px tall with line at y=12, so paddingTop = 76 - 12 = 64.
  return (
    <div
      className="flex shrink-0 items-center"
      aria-hidden
      style={{ paddingTop: 64 }}
    >
      <svg width="60" height="24" viewBox="0 0 60 24" fill="none">
        <defs>
          <marker
            id="roadmap-arrowhead"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M0 0 L10 5 L0 10 z" fill="var(--muted-foreground)" />
          </marker>
        </defs>
        <line
          x1="2"
          y1="12"
          x2="54"
          y2="12"
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-muted-foreground/60"
          markerEnd="url(#roadmap-arrowhead)"
        />
      </svg>
    </div>
  );
}

