"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, Network, Link as LinkIcon, X } from "lucide-react";
import {
  assignTaskToMilestoneAction,
  deleteMilestoneAction,
  unlinkMilestoneAction,
} from "@/app/(app)/w/[workspaceId]/b/[boardId]/milestone-actions";
import { toggleBoardAggregatorAction } from "@/app/(app)/w/[workspaceId]/b/[boardId]/actions";
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
  // Aggregator-only: milestones from other boards that this one aggregates.
  // Empty on non-aggregator boards (or when nothing's linked yet).
  linkedChildren: LinkedChildMilestone[];
}

export interface LinkedChildMilestone {
  linkId: string;
  id: string;
  title: string;
  startAt: string;
  stopAt: string;
  boardId: string;
  boardName: string;
}

// Other boards' milestones available for linking — fed to MilestoneDialog so a
// user editing an aggregator milestone can pick children to link to.
export interface WorkspaceBoardMilestones {
  boardId: string;
  boardName: string;
  milestones: { id: string; title: string; startAt: string; stopAt: string }[];
}

const ROW_HEIGHT = 36;
const TRACK_PADDING_Y = 18;

// Markers-track node geometry. Title block is a HARD fixed height that fits the
// worst case (2-line title clamped + count label) so no node grows taller than
// another — that's what keeps every dot on one horizontal line. The arrow's
// vertical offset is derived from the same constants so connectors stay level.
const NODE_TITLE_H = 56;
const NODE_GAP = 8; // gap-2 between title block and dot
const NODE_DOT = 48; // h-12 dot
const NODE_ARROW_TOP = NODE_TITLE_H + NODE_GAP + NODE_DOT / 2 - 12; // svg line sits at y=12

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
  isAggregator,
  canManageBoard,
  workspaceMilestones,
}: {
  workspaceId: string;
  boardId: string;
  members: MilestoneMember[];
  milestones: MilestoneItem[];
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  initialMode?: Mode;
  isAggregator: boolean;
  canManageBoard: boolean;
  // Only populated when isAggregator (server skips the query otherwise).
  workspaceMilestones: WorkspaceBoardMilestones[];
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
    <div className="flex flex-col gap-5">
      {/* v4 card — one rounded-[22px] glass surface with brand-tinted shadow.
          Inside: toolbar (top) + month axis + swimlanes/markers + hint footer.
          BoardHeader stays OUTSIDE this card (renderowany przez page.tsx).
          Mobile (max-md): chart body chowamy — zastępujemy go vertical
          timeline pod kartą. Toolbar zostaje (counter/aggregator/create). */}
      <div className="relative overflow-hidden rounded-[22px] border border-border bg-card shadow-[0_30px_70px_-30px_rgba(122,92,255,0.4)] max-md:[&_[data-roadmap-chart]]:hidden">
        {/* Toolbar row — counter + aggregator badge/toggle + create button */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card/60 px-[18px] py-[14px] backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <span className="font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted-foreground">
              {milestones.length} {plPlural(milestones.length, "milestone", "milestone’y", "milestone’ów")}
            </span>
            {isAggregator && (
              <span
                title="Ta tablica może agregować milestony z innych tablic w workspace"
                className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-primary"
              >
                <Network size={10} /> Tablica zbiorcza
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {canManageBoard && (
              <form action={toggleBoardAggregatorAction} className="m-0">
                <input type="hidden" name="workspaceId" value={workspaceId} />
                <input type="hidden" name="boardId" value={boardId} />
                <input type="hidden" name="on" value={isAggregator ? "false" : "true"} />
                <button
                  type="submit"
                  title={isAggregator
                    ? "Wyłącz agregację milestonów z innych tablic"
                    : "Włącz aby linkować milestony z innych tablic do tej roadmapy"}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-3 font-mono text-[0.66rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Network size={11} /> {isAggregator ? "Wyłącz zbiorczą" : "Tablica zbiorcza"}
                </button>
              </form>
            )}
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
        </div>

        {/* Month axis — v4: padding-left 150px aligns with swimlane label column.
            Mono, uppercase, muted. Mobile: ukrywamy razem z chart body. */}
        <div data-roadmap-chart className="flex border-b border-border bg-card/40 py-[10px] pl-[150px] pr-[18px] backdrop-blur-xl">
          {range.ticks.map((t) => (
            <div
              key={t.ts}
              className="flex-1 font-mono text-[0.7rem] uppercase tracking-[0.08em] text-muted-foreground"
            >
              {t.label}
            </div>
          ))}
        </div>

        {/* Chart body — relative, today line spans full height.
            data-roadmap-chart → ukrywany na max-md (zastąpiony mobile vertical timeline poniżej). */}
        <div data-roadmap-chart className="relative">
          {todayInRange && (
            <>
              <div
                className="pointer-events-none absolute top-0 bottom-0 z-[3] w-0 border-l-2 border-dashed border-[var(--brand-500)]"
                style={{ left: `${pctFor(now, range)}%` }}
                aria-hidden
              />
              <span
                className="pointer-events-none absolute z-[4] -translate-x-1/2 rounded-sm bg-card px-1 font-mono text-[0.56rem] font-semibold uppercase tracking-[0.14em] text-[var(--brand-500)]"
                style={{ left: `${pctFor(now, range)}%`, top: 6 }}
              >
                dziś
              </span>
            </>
          )}

          {mode === "timeline" ? (
            <TimelineTrack
              range={range}
              milestones={milestones}
              rowMap={rowMap}
              chartHeight={chartHeight}
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

        {/* Hint footer — per v4 spec. Mobile: ukrywamy (chart też jest schowany,
            mobilna lista pod kartą ma własne afordancje tap-to-expand). */}
        <div data-roadmap-chart className="border-t border-border bg-card/40 px-[18px] py-[10px]">
          <span className="text-[0.72rem] text-muted-foreground">
            Hint · najedź na pasek aby zobaczyć podgląd postępu
          </span>
        </div>
        {/* Mobile-only hint inside the toolbar card — gdy chart schowany, user
            ma być pewien, że dostaje pełną zawartość niżej w stack-cards. */}
        <div className="hidden border-t border-border bg-card/40 px-4 py-[10px] max-md:block">
          <span className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground">
            Lista milestonów ↓
          </span>
        </div>
      </div>

      {/* Per-milestone card list with expandable tasks.
          Mobile (v4 spec lines 65-80): vertical timeline — dot+line po lewej,
          progress bar wewnątrz karty. Wszystko via max-md:/md: variants —
          desktop UX bez zmian. */}
      {milestones.length > 0 && (
        <ul className="flex flex-col gap-2 max-md:gap-0">
          {milestones.map((m, mIdx) => {
            const isOpen = expanded.has(m.id);
            const color = colorFor(m.id);
            // Mobile progress: % przedziału czasowego, który już minął.
            // 0% = nie zaczęte; 100% = po stopAt. Wizualizacja zgodna z v4
            // mockupem (linia 74 — bar nad procentem).
            const ms = new Date(m.startAt).getTime();
            const me = new Date(m.stopAt).getTime();
            const progressPct = (() => {
              if (Number.isNaN(ms) || Number.isNaN(me) || me <= ms) return 0;
              if (now <= ms) return 0;
              if (now >= me) return 100;
              return Math.round(((now - ms) / (me - ms)) * 100);
            })();
            const isLast = mIdx === milestones.length - 1;
            return (
              <li
                key={m.id}
                // Mobile: wrap dot-column + card horizontally. Desktop: zwykła karta.
                className="overflow-hidden rounded-lg border border-border bg-card max-md:flex max-md:items-stretch max-md:gap-3 max-md:rounded-none max-md:border-0 max-md:border-transparent max-md:bg-transparent"
              >
                {/* Mobile timeline dot+line column (hidden on md+). */}
                <div className="hidden w-4 shrink-0 flex-col items-center pt-3 max-md:flex">
                  <span
                    className="h-3.5 w-3.5 shrink-0 rounded-full ring-4"
                    style={{
                      background: color,
                      // brand-tint glow per v4 (linia 73: box-shadow 0 0 0 4px glow).
                      // ring-color via inline z color-mix dla brand vibe.
                      boxShadow: `0 0 0 4px color-mix(in oklch, ${color} 28%, transparent)`,
                    }}
                    aria-hidden
                  />
                  {!isLast && (
                    <span
                      className="mt-1 w-0.5 flex-1 bg-border/60"
                      aria-hidden
                    />
                  )}
                </div>

                {/* Card body */}
                <div className="flex-1 max-md:overflow-hidden max-md:rounded-[13px] max-md:border max-md:border-border max-md:bg-card max-md:shadow-[0_8px_18px_-8px_color-mix(in_oklch,var(--brand-500)_22%,transparent)] max-md:mb-4">
                <div className="flex items-center gap-3 px-4 py-3">
                  <span
                    className="h-6 w-1.5 shrink-0 rounded-full max-md:hidden"
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
                    <span className="truncate font-display text-[0.98rem] font-semibold tracking-[-0.01em] max-md:text-[0.92rem]">
                      {m.title}
                    </span>
                    <span className="font-mono text-[0.64rem] uppercase tracking-[0.12em] text-muted-foreground">
                      {formatDateRange(m.startAt, m.stopAt)} · {m.taskCount}{" "}
                      {taskPl(m.taskCount)}
                    </span>
                    {/* Mobile progress bar — pokazuje % upłynięty z zakresu
                        startAt..stopAt. Mirror v4 spec line 74. */}
                    <div className="mt-2 hidden items-center gap-2 max-md:flex">
                      <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${progressPct}%`,
                            background: `linear-gradient(90deg, ${color}, color-mix(in oklch, ${color} 60%, white))`,
                          }}
                        />
                      </div>
                      <span className="font-mono text-[0.62rem] font-bold text-muted-foreground">
                        {progressPct}%
                      </span>
                    </div>
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
                {m.linkedChildren.length > 0 && (
                  <LinkedChildrenRow
                    workspaceId={workspaceId}
                    parentId={m.id}
                    items={m.linkedChildren}
                    canUpdate={canUpdate}
                  />
                )}
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
                            <form
                              action={(fd) => {
                                void assignTaskToMilestoneAction(fd);
                              }}
                              className="m-0"
                            >
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
                </div>
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
          // Resolve from `milestones` (not the stale dialog.milestone) so the
          // linker section reflects the latest links after a revalidate.
          initial={
            dialog.mode === "edit"
              ? (milestones.find((m) => m.id === dialog.milestone.id) ?? dialog.milestone)
              : null
          }
          onClose={() => setDialog(null)}
          isAggregator={isAggregator}
          workspaceMilestones={workspaceMilestones}
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
  now,
  canUpdate,
  onEdit,
}: {
  range: ReturnType<typeof computeTimelineRange>;
  milestones: MilestoneItem[];
  rowMap: Map<string, number>;
  chartHeight: number;
  now: number;
  canUpdate: boolean;
  onEdit: (m: MilestoneItem) => void;
}) {
  void now;
  return (
    <div
      className="relative w-full pl-[150px]"
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

      {milestones.map((m) => {
        const row = rowMap.get(m.id) ?? 0;
        const start = new Date(m.startAt).getTime();
        const stop = new Date(m.stopAt).getTime();
        const left = pctFor(start, range);
        const width = Math.max(pctFor(stop, range) - left, 0.8);
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => canUpdate && onEdit(m)}
            disabled={!canUpdate}
            // v4: bars with brand gradient + shadow tinted brand
            className="group absolute flex items-center gap-2 rounded-[10px] px-[11px] text-left text-[0.72rem] font-semibold text-white shadow-[0_6px_16px_-6px_rgba(124,92,255,0.55),inset_0_1px_0_rgba(255,255,255,0.3)] transition-[transform,opacity] duration-200 hover:-translate-y-[1px] disabled:cursor-default"
            style={{
              top: TRACK_PADDING_Y + row * ROW_HEIGHT + 14,
              left: `${left}%`,
              width: `${width}%`,
              height: 30,
              background: "linear-gradient(135deg, var(--brand-500), var(--brand-700))",
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

// "Wizualizacja" — swimlane layout. Każdy milestone ma własny rząd 58px (per v4
// roadmap spec: swimlanes per status). Label po lewej (150px), bar z gradientem
// brand po prawej rozpięty od startAt do stopAt.
function MarkersTrack({
  range,
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
      <div className="flex h-[200px] items-center justify-center">
        <p className="font-display text-[0.92rem] text-muted-foreground">
          Brak milestones. Dodaj pierwszy, żeby zobaczyć wizualizację.
        </p>
      </div>
    );
  }

  return (
    <div className="relative">
      {sorted.map((m) => {
        const color = colorFor(m.id);
        const start = new Date(m.startAt).getTime();
        const stop = new Date(m.stopAt).getTime();
        const left = pctFor(start, range);
        const width = Math.max(pctFor(stop, range) - left, 0.8);
        return (
          <SwimlaneRow
            key={m.id}
            milestone={m}
            color={color}
            left={left}
            width={width}
            canUpdate={canUpdate}
            onEdit={onEdit}
          />
        );
      })}
    </div>
  );
}

function SwimlaneRow({
  milestone,
  color,
  left,
  width,
  canUpdate,
  onEdit,
}: {
  milestone: MilestoneItem;
  color: string;
  left: number;
  width: number;
  canUpdate: boolean;
  onEdit: (m: MilestoneItem) => void;
}) {
  void color;
  return (
    <div className="flex h-[58px] items-center border-b border-border/60 last:border-b-0">
      {/* Status/label column — 150px per v4 spec */}
      <div className="flex w-[150px] flex-none items-center gap-2 px-[18px]">
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ background: color }}
          aria-hidden
        />
        <span className="truncate text-[0.78rem] font-semibold text-foreground">
          {milestone.title}
        </span>
      </div>
      {/* Bar track */}
      <div className="relative h-full flex-1">
        <button
          type="button"
          onClick={() => canUpdate && onEdit(milestone)}
          disabled={!canUpdate}
          className="absolute flex items-center rounded-[10px] px-[11px] text-left shadow-[0_6px_16px_-6px_rgba(124,92,255,0.55),inset_0_1px_0_rgba(255,255,255,0.3)] transition-transform duration-200 hover:-translate-y-[1px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-default"
          style={{
            top: 14,
            left: `${left}%`,
            width: `${width}%`,
            height: 30,
            background: "linear-gradient(135deg, var(--brand-500), var(--brand-700))",
          }}
          title={`${milestone.title} · ${formatDateRange(milestone.startAt, milestone.stopAt)}`}
          aria-label={`${milestone.title}, edytuj`}
        >
          <span className="truncate text-[0.72rem] font-semibold text-white">
            {milestone.title}
          </span>
          <span className="ml-2 shrink-0 rounded-full bg-white/25 px-1.5 font-mono text-[0.58rem] font-bold text-white">
            {milestone.taskCount}
          </span>
        </button>
      </div>
    </div>
  );
}

// Backwards-compat exports (rendered indirectly via MarkersTrack now). Kept
// because timeline-utils + flow geometry may still be used by other callers.
// Unused right now but cheap to keep — Next prunes dead imports at build time.
export function _milestoneNodeStub() {
  void NODE_TITLE_H;
  void NODE_GAP;
  void NODE_DOT;
  void NODE_ARROW_TOP;
  void MilestoneNode;
  void FlowArrow;
  void useParams;
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
      <div
        className="flex shrink-0 flex-col items-center justify-center gap-0.5 overflow-hidden text-center"
        style={{ height: NODE_TITLE_H }}
      >
        <span className="font-display text-[0.92rem] font-semibold leading-tight tracking-[-0.01em] line-clamp-2">
          {milestone.title}
        </span>
        <span className="font-mono text-[0.56rem] uppercase tracking-[0.12em] text-muted-foreground">
          {milestone.taskCount} {taskPl(milestone.taskCount)}
        </span>
      </div>

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

function FlowArrow() {
  return (
    <div
      className="flex shrink-0 items-center"
      aria-hidden
      style={{ paddingTop: NODE_ARROW_TOP }}
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

// Strip between the milestone header and the (optional) task expansion. Lists
// the sub-board milestones that the aggregator milestone references. Each item
// links to its source board's roadmap; unlink is gated by milestone.update.
function LinkedChildrenRow({
  workspaceId,
  parentId,
  items,
  canUpdate,
}: {
  workspaceId: string;
  parentId: string;
  items: LinkedChildMilestone[];
  canUpdate: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5 border-t border-border bg-muted/10 px-4 py-2.5">
      <div className="flex items-center gap-1.5 font-mono text-[0.58rem] uppercase tracking-[0.14em] text-muted-foreground/80">
        <LinkIcon size={9} /> Linkowane z innych tablic ({items.length})
      </div>
      <ul className="flex flex-wrap gap-1.5">
        {items.map((child) => (
          <li key={child.linkId}>
            <span className="group inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-[0.76rem]">
              <Link
                href={`/w/${workspaceId}/b/${child.boardId}/roadmap`}
                className="inline-flex items-center gap-1.5 transition-colors hover:text-primary"
                title={`${child.boardName} · ${formatDateRange(child.startAt, child.stopAt)}`}
              >
                <span className="font-mono text-[0.58rem] uppercase tracking-[0.12em] text-muted-foreground">
                  {child.boardName}
                </span>
                <span className="font-medium">{child.title}</span>
              </Link>
              {canUpdate && (
                <form
                  action={(fd) => {
                    void unlinkMilestoneAction(fd);
                  }}
                  className="m-0"
                >
                  <input type="hidden" name="parentId" value={parentId} />
                  <input type="hidden" name="childId" value={child.id} />
                  <button
                    type="submit"
                    aria-label="Odlinkuj"
                    title="Odlinkuj"
                    className="grid h-4 w-4 place-items-center rounded-sm text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                  >
                    <X size={10} />
                  </button>
                </form>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
