"use client";

// Roadmapa (B6): miesięczna oś + dwa tryby — „Paski" (belki milestone'ów
// z rozwijanymi paskami zadań) i „Markery" (kropki z liczbą zadań spięte
// przerywanymi łukami). Cała matematyka siedzi w `roadmap-model.ts`.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { unlinkMilestoneAction } from "@/app/(app)/w/[workspaceId]/b/[boardId]/milestone-actions";
import { AggregatorToggle } from "@/components/roadmap/aggregator-toggle";
import {
  MilestoneDialog,
  type MilestoneMember,
  type MilestonePatch,
} from "@/components/roadmap/milestone-dialog";
import {
  GRID_W,
  MARKER_STAGGER,
  MARKER_TOP,
  MONTH_W,
  arcAngle,
  arcPath,
  arrowHead,
  axisWidth,
  doneStatusIds,
  markerFontSize,
  markerHue,
  markerSize,
  milestoneLabel,
  monthColumns,
  progressOf,
  sortMilestones,
  spanX,
  xForTs,
  type MarkerHue,
} from "@/components/roadmap/roadmap-model";
import { Button } from "@/components/ui/button";
import { CHIP_HUE } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import {
  IconChevronDown,
  IconChevronRight,
  IconClose,
  IconMilestone,
  IconMore,
  IconPlus,
} from "@/components/ui/icons";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/dropdown-menu";
import { Segmented } from "@/components/ui/segmented";
import { hueForColor } from "@/components/ui/status-hue";
import { useUiPref } from "@/hooks/use-ui-pref";
import { boardPl, plPlural } from "@/lib/pluralize";
import { cn } from "@/lib/utils";

export interface MilestoneTask {
  id: string;
  title: string;
  statusColumnId?: string | null;
  statusName?: string | null;
  statusColorHex?: string | null;
  startAt?: string | null;
  stopAt?: string | null;
}

export interface MilestoneItem {
  id: string;
  title: string;
  startAt: string;
  stopAt: string;
  assignee: MilestoneMember | null;
  taskCount: number;
  tasks: MilestoneTask[];
  descriptionText?: string;
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

export type RoadmapMode = "bars" | "markers";

const MODE_OPTIONS = [
  { value: "bars" as const, label: "Paski" },
  { value: "markers" as const, label: "Markery" },
];
const MARKER_CLASS: Record<MarkerHue, string> = {
  gray: "bg-chip-gray-bg border-n-500 text-chip-gray-fg",
  blue: "bg-chip-blue-bg border-info text-chip-blue-fg",
  green: "bg-chip-green-bg border-success text-chip-green-fg",
};
const dayFmt = new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "short" });
const day = (iso: string) => dayFmt.format(new Date(iso));

export function RoadmapView({
  workspaceId,
  boardId,
  boardName,
  boardViewId,
  members,
  milestones,
  statusColumns = [],
  canCreate,
  canUpdate,
  canDelete,
  initialMode = "bars",
  isAggregator,
  canManageBoard,
  workspaceMilestones,
}: {
  workspaceId: string;
  boardId: string;
  /** Nazwa tablicy w metrycze paska („N/M · tablica"). */
  boardName?: string;
  // F12-K134: set gdy renderowane w custom named ROADMAP view — nowe
  // milestones dostają scope do tego view'a.
  boardViewId?: string;
  members: MilestoneMember[];
  milestones: MilestoneItem[];
  /** Kolumny statusów tablicy — z nich liczymy „N/M" i kolory pasków zadań. */
  statusColumns?: { id: string; name: string; colorHex: string; order: number }[];
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  initialMode?: RoadmapMode;
  isAggregator: boolean;
  canManageBoard: boolean;
  // Only populated when isAggregator (server skips the query otherwise).
  workspaceMilestones: WorkspaceBoardMilestones[];
}) {
  const [mode, setMode] = useUiPref<RoadmapMode>("ui:roadmap-mode", initialMode);
  const [dialog, setDialog] = useState<{ mode: "create" } | { mode: "edit"; id: string } | null>(null);
  const [expanded, setExpanded] = useState<string[]>([]);
  // Stable "now" captured once at mount; Date.now() during render breaks purity
  // and the „Dziś" line doesn't need to tick live.
  const [now] = useState(() => Date.now());

  // Optimistic echo of a save/delete so the change is on screen before the
  // server action's revalidate lands. Cleared as soon as fresh props arrive.
  const [patches, setPatches] = useState<Record<string, MilestonePatch>>({});
  const [removed, setRemoved] = useState<string[]>([]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPatches({});
    setRemoved([]);
  }, [milestones]);

  const items = useMemo(() => {
    const gone = new Set(removed);
    return sortMilestones(
      milestones.filter((m) => !gone.has(m.id)).map((m) => (patches[m.id] ? { ...m, ...patches[m.id]! } : m)),
    );
  }, [milestones, patches, removed]);

  const months = useMemo(() => monthColumns(items, now), [items, now]);
  const width = axisWidth(months);
  const doneIds = useMemo(() => doneStatusIds(statusColumns), [statusColumns]);
  const boardCount = useMemo(
    () => new Set([boardId, ...milestones.flatMap((m) => m.linkedChildren.map((c) => c.boardId))]).size,
    [boardId, milestones],
  );

  const toggle = (id: string) =>
    setExpanded((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const editing = dialog?.mode === "edit" ? items.find((m) => m.id === dialog.id) : undefined;

  return (
    <div data-ui="roadmap" className="-mx-6 -my-4 flex flex-col max-md:-mx-4">
      {/* Toolbar — tryb + „Tablica zbiorcza" + menu ⋯ */}
      <div className="flex flex-none flex-wrap items-center gap-2 border-b border-border px-6 py-2 max-md:px-4">
        <Segmented options={MODE_OPTIONS} value={mode} onChange={setMode} aria-label="Tryb roadmapy" />
        {canManageBoard && (
          <AggregatorToggle
            workspaceId={workspaceId}
            boardId={boardId}
            initialOn={isAggregator}
            boardCount={boardCount}
          />
        )}
        {mode === "markers" && (
          <span className="ml-2 text-xs text-n-500 max-md:hidden">
            Kropka = milestone, liczba = zadania; strzałki pokazują kolejność.
          </span>
        )}
        <span className="flex-1" />
        <Menu>
          <MenuTrigger
            aria-label="Opcje roadmapy"
            className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-n-100 hover:text-foreground active:bg-n-200 data-popup-open:bg-n-100"
          >
            <IconMore />
          </MenuTrigger>
          <MenuContent align="end">
            <MenuItem icon={<IconPlus width={14} height={14} />} disabled={!canCreate} onClick={() => setDialog({ mode: "create" })}>
              Nowy milestone
            </MenuItem>
            <MenuItem
              icon={<IconChevronDown width={14} height={14} />}
              disabled={items.length === 0}
              onClick={() => setExpanded(expanded.length === items.length ? [] : items.map((m) => m.id))}
            >
              {expanded.length === items.length && items.length > 0 ? "Zwiń wszystkie" : "Rozwiń wszystkie"}
            </MenuItem>
          </MenuContent>
        </Menu>
      </div>

      {items.length === 0 ? (
        <div className="flex items-center justify-center p-8">
          <EmptyState
            icon={<IconMilestone />}
            title="Brak milestone'ów"
            description="Dodaj pierwszy, żeby zobaczyć roadmapę."
            action={
              canCreate ? (
                <Button size="sm" onClick={() => setDialog({ mode: "create" })}>
                  <IconPlus width={14} height={14} /> Nowy milestone
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="max-h-[600px] overflow-auto">
          <div className="relative" style={{ width, minWidth: "100%" }}>
            {/* Oś miesięcy */}
            <div className="sticky top-0 z-[3] flex h-9 border-b border-border bg-canvas">
              {months.map((m) => (
                <span
                  key={m.ts}
                  style={{ width: MONTH_W }}
                  className="flex flex-none items-end border-r border-table-grid px-2 pb-1 text-2xs font-semibold tracking-[.06em] text-muted-foreground uppercase"
                >
                  {m.label}
                </span>
              ))}
            </div>

            {/* Kanwa: pionowa siatka + linia „Dziś" + treść trybu */}
            <div
              className="relative"
              style={{
                backgroundImage: `repeating-linear-gradient(90deg, transparent 0 ${GRID_W}px, var(--table-grid) ${GRID_W}px ${GRID_W + 1}px)`,
              }}
            >
              <span
                aria-hidden
                className="pointer-events-none absolute top-0 bottom-0 z-0 w-0.5 bg-orange-500"
                style={{ left: Math.min(width - 2, xForTs(now, months)) }}
              />
              <span
                aria-hidden
                className="pointer-events-none absolute top-1.5 z-[2] inline-flex h-[18px] items-center rounded-sm bg-orange-500 px-1.5 text-[10px] font-bold text-ink"
                style={{ left: Math.max(0, xForTs(now, months) - 12) }}
              >
                Dziś
              </span>

              {mode === "bars" ? (
                <BarsTrack
                  items={items}
                  months={months}
                  doneIds={doneIds}
                  boardName={boardName}
                  workspaceId={workspaceId}
                  expanded={expanded}
                  canUpdate={canUpdate}
                  onToggle={toggle}
                  onOpen={(id) => setDialog({ mode: "edit", id })}
                />
              ) : (
                <MarkersTrack
                  items={items}
                  months={months}
                  doneIds={doneIds}
                  width={width}
                  canUpdate={canUpdate}
                  onOpen={(id) => setDialog({ mode: "edit", id })}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Stopka licznikowa */}
      <div className="flex h-8 flex-none items-center border-t border-border bg-canvas px-6 max-md:px-4">
        <span className="font-mono text-2xs text-muted-foreground">
          {items.length} {plPlural(items.length, "milestone", "milestone'y", "milestone'ów")}
          {boardCount > 1 ? ` · ${boardCount} ${boardPl(boardCount)}` : ""} · tryb:{" "}
          {mode === "bars" ? "paski" : "markery"}
        </span>
      </div>

      {dialog && (dialog.mode === "create" || editing) && (
        <MilestoneDialog
          key={dialog.mode === "edit" ? `edit-${dialog.id}` : "create"}
          workspaceId={workspaceId}
          boardId={boardId}
          boardViewId={boardViewId}
          members={members}
          mode={dialog.mode}
          initial={editing ?? null}
          milestoneLabel={editing ? milestoneLabel(items.indexOf(editing)) : undefined}
          canDelete={canDelete}
          onClose={() => setDialog(null)}
          onSaved={(id, patch) => setPatches((p) => ({ ...p, [id]: patch }))}
          onDeleted={(id) => setRemoved((r) => [...r, id])}
          isAggregator={isAggregator}
          workspaceMilestones={workspaceMilestones}
        />
      )}
    </div>
  );
}

// ── Paski ────────────────────────────────────────────────────────────────────

function BarsTrack({
  items,
  months,
  doneIds,
  boardName,
  workspaceId,
  expanded,
  canUpdate,
  onToggle,
  onOpen,
}: {
  items: MilestoneItem[];
  months: { ts: number; label: string }[];
  doneIds: Set<string>;
  boardName?: string;
  workspaceId: string;
  expanded: string[];
  canUpdate: boolean;
  onToggle: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  return (
    <ul className="relative z-[1] flex flex-col gap-3 py-6 pr-6 pl-2">
      {items.map((m, i) => {
        const bar = spanX(m.startAt, m.stopAt, months, 260);
        const p = progressOf(m.tasks, doneIds);
        const open = expanded.includes(m.id);
        return (
          <li key={m.id}>
            <div
              data-ui="roadmap-bar"
              style={{ marginLeft: bar.left, width: bar.width }}
              className="flex h-7 items-center gap-2 rounded-sm border border-orange-600 bg-orange-100 pr-2.5 pl-1.5"
            >
              <button
                type="button"
                onClick={() => onToggle(m.id)}
                aria-expanded={open}
                aria-label={open ? `Zwiń ${m.title}` : `Rozwiń ${m.title}`}
                className="inline-flex size-6 shrink-0 items-center justify-center rounded-sm text-chip-orange-fg outline-none hover:bg-orange-200 active:bg-orange-300"
              >
                {open ? <IconChevronDown width={12} height={12} /> : <IconChevronRight width={12} height={12} />}
              </button>
              <button
                type="button"
                onClick={() => onOpen(m.id)}
                disabled={!canUpdate}
                title={`${m.title} — ${day(m.startAt)} → ${day(m.stopAt)}`}
                className="flex min-w-0 flex-1 items-center gap-2 rounded-sm text-left outline-none hover:underline active:opacity-70 disabled:cursor-default disabled:no-underline disabled:opacity-100"
              >
                <span className="truncate text-xs font-semibold text-chip-orange-fg">
                  {milestoneLabel(i)} · {m.title}
                </span>
                <span className="shrink-0 font-mono text-[10px] text-chip-orange-fg">
                  {p.done}/{p.total}
                  {boardName ? ` · ${boardName}` : ""}
                </span>
              </button>
              {p.total > 0 && (
                <span className="h-1 w-20 shrink-0 overflow-hidden rounded-[2px] bg-chip-orange-fg/20">
                  <span className="block h-1 bg-chip-orange-fg" style={{ width: `${p.pct}%` }} />
                </span>
              )}
            </div>

            {open && (
              <div className="mt-1.5 flex flex-col gap-1">
                {m.tasks.map((t) => {
                  const s = spanX(t.startAt ?? m.startAt, t.stopAt ?? m.stopAt, months, 140);
                  return (
                    <Link
                      key={t.id}
                      href={`/w/${workspaceId}/t/${t.id}`}
                      style={{ marginLeft: s.left + 24, width: s.width }}
                      title={t.title}
                      className={cn(
                        "block h-4 truncate rounded-sm border border-current px-1.5 text-[10px] leading-[14px] font-medium no-underline outline-none hover:opacity-80 active:opacity-70",
                        CHIP_HUE[hueForColor(t.statusColorHex)],
                      )}
                    >
                      {t.title}
                      {t.statusName ? ` · ${t.statusName}` : ""}
                    </Link>
                  );
                })}
                {m.tasks.length === 0 && (
                  <p className="text-xs text-muted-foreground" style={{ marginLeft: bar.left + 24 }}>
                    Brak zadań w tym milestone.
                  </p>
                )}
                {m.linkedChildren.length > 0 && (
                  <LinkedChildren
                    workspaceId={workspaceId}
                    parentId={m.id}
                    items={m.linkedChildren}
                    canUpdate={canUpdate}
                    offset={bar.left + 24}
                  />
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

// ── Markery ──────────────────────────────────────────────────────────────────

function MarkersTrack({
  items,
  months,
  doneIds,
  width,
  canUpdate,
  onOpen,
}: {
  items: MilestoneItem[];
  months: { ts: number; label: string }[];
  doneIds: Set<string>;
  width: number;
  canUpdate: boolean;
  onOpen: (id: string) => void;
}) {
  const nodes = useMemo(
    () =>
      items.map((m, i) => {
        const p = progressOf(m.tasks, doneIds);
        const d = markerSize(m.taskCount);
        return {
          m,
          p,
          d,
          cx: xForTs(new Date(m.stopAt).getTime(), months),
          cy: MARKER_TOP + (i % 2 === 1 ? MARKER_STAGGER : 0),
          hue: markerHue(p.pct),
        };
      }),
    [items, months, doneIds],
  );

  const height = MARKER_TOP + MARKER_STAGGER + 26 + 76;
  const arcs = nodes.slice(0, -1).map((a, i) => {
    const b = nodes[i + 1]!;
    const x1 = a.cx + a.d / 2 + 4;
    const x2 = b.cx - b.d / 2 - 8;
    const bulge = i % 2 === 0 ? -56 : 56;
    return {
      key: a.m.id,
      d: arcPath(x1, a.cy, x2, b.cy, bulge),
      head: arrowHead(x2, b.cy, arcAngle(x1, a.cy, x2, b.cy, bulge)),
    };
  });

  return (
    <div className="relative z-[1]" style={{ height }}>
      <svg
        aria-hidden
        className="pointer-events-none absolute top-0 left-0"
        width={Math.max(width, 1)}
        height={height}
        fill="none"
      >
        {arcs.map((a) => (
          <g key={a.key}>
            <path d={a.d} stroke="var(--gantt-dependency)" strokeWidth="1.5" strokeDasharray="4 4" />
            <path d={a.head} fill="var(--gantt-dependency)" />
          </g>
        ))}
      </svg>

      {nodes.map(({ m, p, d, cx, cy, hue }, i) => (
        <div
          key={m.id}
          data-ui="roadmap-marker"
          className="absolute flex w-40 -translate-x-1/2 flex-col items-center gap-1.5 text-center"
          style={{ left: cx, top: cy - d / 2 }}
        >
          <button
            type="button"
            onClick={() => onOpen(m.id)}
            disabled={!canUpdate}
            title={`${m.title} — ${p.done}/${p.total}`}
            style={{ width: d, height: d, fontSize: markerFontSize(d) }}
            className={cn(
              "inline-flex shrink-0 items-center justify-center rounded-full border-2 font-bold outline-none duration-150 ease-[var(--ease-out)] hover:scale-105 active:scale-95 disabled:cursor-default disabled:hover:scale-100 motion-reduce:transform-none motion-safe:transition-transform",
              MARKER_CLASS[hue],
            )}
          >
            {m.taskCount}
          </button>
          <span className="text-xs font-semibold">
            {milestoneLabel(i)} · {m.title}
          </span>
          <span className="font-mono text-[10px] text-n-500">
            do {day(m.stopAt)} · {p.done}/{p.total}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Linkowane milestone'y (tablica zbiorcza) ─────────────────────────────────

function LinkedChildren({
  workspaceId,
  parentId,
  items,
  canUpdate,
  offset,
}: {
  workspaceId: string;
  parentId: string;
  items: LinkedChildMilestone[];
  canUpdate: boolean;
  offset: number;
}) {
  return (
    <ul className="flex flex-wrap gap-1.5" style={{ marginLeft: offset }}>
      {items.map((c) => (
        <li key={c.linkId}>
          <span className="inline-flex items-center gap-1 rounded-sm border border-border bg-card py-0.5 pr-0.5 pl-2 text-[10px]">
            <Link
              href={`/w/${workspaceId}/b/${c.boardId}/roadmap`}
              title={`${c.boardName} · ${day(c.startAt)} → ${day(c.stopAt)}`}
              className="text-foreground no-underline outline-none hover:text-link hover:underline active:opacity-70"
            >
              <span className="text-muted-foreground">{c.boardName} · </span>
              {c.title}
            </Link>
            {canUpdate && (
              <form action={(fd) => void unlinkMilestoneAction(fd)} className="m-0">
                <input type="hidden" name="parentId" value={parentId} />
                <input type="hidden" name="childId" value={c.id} />
                <button
                  type="submit"
                  aria-label={`Odlinkuj ${c.title}`}
                  title="Odlinkuj"
                  className="inline-flex size-6 items-center justify-center rounded-sm text-muted-foreground outline-none hover:bg-n-100 hover:text-danger-text active:bg-n-200"
                >
                  <IconClose width={10} height={10} />
                </button>
              </form>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}
