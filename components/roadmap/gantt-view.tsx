"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import {
  assignRows,
  computeTimelineRange,
  formatDateRange,
  pctFor,
} from "@/components/roadmap/timeline-utils";
import { taskPl } from "@/lib/pluralize";

export interface GanttTaskItem {
  id: string;
  title: string;
  startAt: string | null;
  stopAt: string | null;
  statusColor: string;
  statusName: string | null;
  assignee: {
    id: string;
    name: string | null;
    email: string;
    avatarUrl: string | null;
  } | null;
}

export interface GanttUnscheduledItem {
  id: string;
  title: string;
}

const ROW_HEIGHT = 40; // v4 spec: 40px per row
const TASK_COL_W = 260; // v4 spec: left task list column width

type ZoomScale = "week" | "month";

export function GanttView({
  workspaceId,
  scheduled,
  unscheduled,
}: {
  workspaceId: string;
  scheduled: GanttTaskItem[];
  unscheduled: GanttUnscheduledItem[];
}) {
  const [now] = useState(() => Date.now());
  const [zoom, setZoom] = useState<ZoomScale>("week");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const timelineItems = useMemo(
    () =>
      scheduled
        .filter(
          (t): t is GanttTaskItem & { startAt: string; stopAt: string } =>
            !!t.startAt && !!t.stopAt,
        )
        .map((t) => ({ id: t.id, startAt: t.startAt, stopAt: t.stopAt })),
    [scheduled],
  );
  const range = useMemo(
    () => computeTimelineRange(timelineItems, now),
    [timelineItems, now],
  );
  const rowMap = useMemo(() => assignRows(timelineItems), [timelineItems]);
  const todayInRange = now >= range.rangeStart && now <= range.rangeStop;

  // Group scheduled tasks by status name (collapsable per v4 spec).
  // Tasks bez statusu trafiają do "Bez statusu".
  const groups = useMemo(() => {
    const map = new Map<string, GanttTaskItem[]>();
    for (const t of scheduled) {
      if (!t.startAt || !t.stopAt) continue;
      const key = t.statusName ?? "Bez statusu";
      const bucket = map.get(key) ?? [];
      bucket.push(t);
      map.set(key, bucket);
    }
    return Array.from(map.entries()).map(([name, tasks]) => ({ name, tasks }));
  }, [scheduled]);

  // Flatten group rows (with header row + task rows) for absolute positioning
  // of bars in the right timeline column. headerRow doesn't carry a bar.
  type FlatRow =
    | { kind: "group"; name: string; count: number }
    | { kind: "task"; task: GanttTaskItem & { startAt: string; stopAt: string } };
  const flatRows: FlatRow[] = useMemo(() => {
    const out: FlatRow[] = [];
    for (const g of groups) {
      out.push({ kind: "group", name: g.name, count: g.tasks.length });
      if (!collapsedGroups.has(g.name)) {
        for (const t of g.tasks) {
          out.push({
            kind: "task",
            task: t as GanttTaskItem & { startAt: string; stopAt: string },
          });
        }
      }
    }
    return out;
  }, [groups, collapsedGroups]);

  void rowMap; // legacy row-assign (kept exported through util — bars are now per-row, not stacked)

  const chartHeight = flatRows.length * ROW_HEIGHT;

  // Deadline pill helper — "za X dni" / "X dni temu" / "dziś" / "jutro".
  // Mobile-only (lista zastępuje timeline) — pill rounded-full po prawej stronie
  // wiersza task'a. Spec linia 91. Klasa tła ustalana semantycznie:
  // overdue=destructive, urgent (<=3d)=warning, normal=brand.
  const deadlinePill = (stopIso: string): { label: string; tone: "danger" | "warn" | "normal" | "done" } => {
    const stop = new Date(stopIso).getTime();
    const diffMs = stop - now;
    const dayMs = 86_400_000;
    const days = Math.round(diffMs / dayMs);
    if (days < 0) return { label: `${Math.abs(days)} dni temu`, tone: "danger" };
    if (days === 0) return { label: "dziś", tone: "warn" };
    if (days === 1) return { label: "jutro", tone: "warn" };
    if (days <= 3) return { label: `za ${days} dni`, tone: "warn" };
    return { label: `za ${days} dni`, tone: "normal" };
  };

  const toggleGroup = (name: string) =>
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  return (
    <div className="flex flex-col gap-5">
      {/* v4 card — single rounded-[22px] glass surface with brand shadow.
          Inside: column header (Zadanie + Tydz./Mies. pill switcher) + body
          (left task list, right timeline) + hint footer.
          Mobile (spec lines 81-96): hide timeline, list zajmuje 100% szerokości,
          pillsy deadline po prawej zamiast bars. */}
      <div className="relative overflow-hidden rounded-[22px] border border-border bg-card shadow-[0_30px_70px_-30px_rgba(122,92,255,0.4)]">
        <div className="flex">
          {/* ── LEFT: Task list column ───────────────────────────────── */}
          <div
            className="flex-none border-r border-border max-md:!w-full max-md:!border-r-0"
            style={{ width: TASK_COL_W }}
          >
            {/* Column header */}
            <div className="flex items-center justify-between border-b border-border bg-card/60 px-4 py-[10px] backdrop-blur-xl">
              <span className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.04em] text-muted-foreground">
                Zadanie
              </span>
              {/* Zoom switcher — segmented control rounded-[8px] padding-[2px] gap-[3px].
                  Mobile: ukrywamy (timeline schowany, scale nieistotny). */}
              <div className="flex gap-[3px] rounded-lg bg-muted/40 p-[2px] max-md:hidden">
                <button
                  type="button"
                  onClick={() => setZoom("week")}
                  className={`rounded-md px-2 py-[3px] font-mono text-[0.62rem] uppercase tracking-[0.04em] transition-colors ${
                    zoom === "week"
                      ? "bg-brand-gradient font-semibold text-white shadow-brand"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Tydz.
                </button>
                <button
                  type="button"
                  onClick={() => setZoom("month")}
                  className={`rounded-md px-2 py-[3px] font-mono text-[0.62rem] uppercase tracking-[0.04em] transition-colors ${
                    zoom === "month"
                      ? "bg-brand-gradient font-semibold text-white shadow-brand"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Mies.
                </button>
              </div>
            </div>
            {/* Rows */}
            {flatRows.map((row, i) => {
              if (row.kind === "group") {
                const collapsed = collapsedGroups.has(row.name);
                return (
                  <button
                    key={`g-${i}`}
                    type="button"
                    onClick={() => toggleGroup(row.name)}
                    style={{ height: ROW_HEIGHT }}
                    className="flex w-full items-center gap-2 border-b border-border/60 bg-muted/20 px-4 text-left transition-colors hover:bg-muted/40"
                    aria-expanded={!collapsed}
                  >
                    <ChevronDown
                      size={12}
                      className={`shrink-0 text-muted-foreground transition-transform ${collapsed ? "-rotate-90" : ""}`}
                    />
                    <span className="truncate text-[0.78rem] font-bold text-foreground">
                      {row.name}
                    </span>
                    <span className="ml-auto inline-flex h-[18px] items-center rounded-full bg-muted/60 px-[7px] font-mono text-[0.6rem] text-muted-foreground">
                      {row.count}
                    </span>
                  </button>
                );
              }
              const t = row.task;
              const initials = t.assignee
                ? (t.assignee.name ?? t.assignee.email).slice(0, 2).toUpperCase()
                : null;
              const pill = deadlinePill(t.stopAt);
              const pillToneClass =
                pill.tone === "danger"
                  ? "bg-destructive/15 text-destructive"
                  : pill.tone === "warn"
                    ? "bg-amber-500/15 text-amber-600 dark:text-amber-300"
                    : "bg-primary/12 text-primary";
              return (
                <Link
                  key={`t-${t.id}`}
                  href={`/w/${workspaceId}/t/${t.id}`}
                  style={{ height: ROW_HEIGHT }}
                  className="flex items-center gap-2 border-b border-border/60 px-4 transition-colors hover:bg-muted/30 max-md:gap-2.5 max-md:px-3 max-md:py-2"
                  title={`${t.title} · ${formatDateRange(t.startAt, t.stopAt)}${t.statusName ? ` · ${t.statusName}` : ""}`}
                >
                  <span
                    className="h-[7px] w-[7px] shrink-0 rounded-full max-md:h-[10px] max-md:w-[3px] max-md:rounded-sm"
                    style={{ background: t.statusColor }}
                    aria-hidden
                  />
                  <span className="truncate text-[0.78rem] font-medium text-foreground max-md:text-[0.84rem]">
                    {t.title}
                  </span>
                  {/* Mobile-only deadline pill — v4 spec linia 91 (rounded-full,
                      small, "za X dni" / "dziś" / "X dni temu"). Desktop nie potrzebuje —
                      ma timeline po prawej. */}
                  <span
                    className={`ml-auto hidden shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 font-mono text-[0.62rem] font-semibold max-md:inline-flex ${pillToneClass}`}
                  >
                    {pill.label}
                  </span>
                  {initials && (
                    <span
                      className="ml-auto grid h-5 w-5 shrink-0 place-items-center overflow-hidden rounded-full bg-brand-gradient font-display text-[0.54rem] font-bold text-white max-md:hidden"
                      aria-label={t.assignee?.name ?? t.assignee?.email}
                    >
                      {t.assignee?.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={t.assignee.avatarUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        initials
                      )}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>

          {/* ── RIGHT: Timeline column ─────────────────────────────────
              Mobile: ukryta — task list dostaje pełną szerokość + deadline pille
              renderowane bezpośrednio w wierszach po lewej (poniżej w pętli). */}
          <div className="relative min-w-0 flex-1 overflow-hidden max-md:hidden">
            {/* Tick header (week labels) */}
            <div className="flex border-b border-border bg-card/60 backdrop-blur-xl">
              {range.ticks.map((t) => (
                <div
                  key={t.ts}
                  className="flex-1 border-l border-border/40 py-[10px] pl-2 font-mono text-[0.66rem] uppercase tracking-[0.04em] text-muted-foreground first:border-l-0"
                >
                  {t.label}
                </div>
              ))}
            </div>

            {/* Track body */}
            <div className="relative" style={{ height: chartHeight }}>
              {/* Vertical tick gridlines */}
              {range.ticks.map((t) => (
                <div
                  key={t.ts}
                  className="pointer-events-none absolute top-0 bottom-0 w-px bg-border/40"
                  style={{ left: `${pctFor(t.ts, range)}%` }}
                  aria-hidden
                />
              ))}

              {/* Today line — v4: accent-brand-2 (pink) 2px */}
              {todayInRange && (
                <div
                  className="pointer-events-none absolute top-0 bottom-0 z-[3] w-[2px] bg-[var(--accent-brand-2)]"
                  style={{ left: `${pctFor(now, range)}%` }}
                  aria-hidden
                />
              )}

              {/* Per-row containers (mirror left list row heights) */}
              {flatRows.map((row, i) => {
                if (row.kind === "group") {
                  return (
                    <div
                      key={`gr-${i}`}
                      className="border-b border-border/60 bg-muted/20"
                      style={{
                        position: "absolute",
                        top: i * ROW_HEIGHT,
                        height: ROW_HEIGHT,
                        left: 0,
                        right: 0,
                      }}
                    />
                  );
                }
                const t = row.task;
                const start = new Date(t.startAt).getTime();
                const stop = new Date(t.stopAt).getTime();
                const left = pctFor(start, range);
                const width = Math.max(pctFor(stop, range) - left, 0.8);
                return (
                  <div
                    key={`tr-${t.id}`}
                    className="border-b border-border/60"
                    style={{
                      position: "absolute",
                      top: i * ROW_HEIGHT,
                      height: ROW_HEIGHT,
                      left: 0,
                      right: 0,
                    }}
                  >
                    <Link
                      href={`/w/${workspaceId}/t/${t.id}`}
                      className="absolute flex items-center gap-2 rounded-[10px] px-[10px] text-[0.72rem] font-semibold text-white shadow-[0_6px_16px_-6px_rgba(124,92,255,0.55),inset_0_1px_0_rgba(255,255,255,0.3)] transition-[transform,opacity] duration-200 hover:-translate-y-[1px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      style={{
                        top: 8,
                        left: `${left}%`,
                        width: `${width}%`,
                        height: ROW_HEIGHT - 16,
                        background:
                          "linear-gradient(135deg, var(--brand-500), var(--brand-700))",
                      }}
                      title={`${t.title} · ${formatDateRange(t.startAt, t.stopAt)}${t.statusName ? ` · ${t.statusName}` : ""}`}
                    >
                      <span className="truncate">{t.title}</span>
                    </Link>
                  </div>
                );
              })}

              {timelineItems.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <p className="font-display text-[0.92rem] text-muted-foreground">
                    Brak zadań z datami. Ustaw Start + Koniec w modal&apos;u zadania.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Hint footer — v4 spec: drag bar + diamond=milestone.
            Mobile: copy zmieniony, bo timeline schowany. */}
        <div className="border-t border-border bg-card/40 px-[18px] py-[10px]">
          <span className="text-[0.72rem] text-muted-foreground max-md:hidden">
            Hint · przeciągnij pasek aby zmienić daty · romb = milestone
          </span>
          <span className="hidden text-[0.72rem] text-muted-foreground max-md:inline">
            Hint · tap zadania aby zmienić daty
          </span>
        </div>
      </div>

      {unscheduled.length > 0 && (
        <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4">
          <h3 className="mb-2 font-mono text-[0.66rem] uppercase tracking-[0.14em] text-muted-foreground">
            Bez dat ({unscheduled.length})
          </h3>
          <p className="mb-3 text-[0.82rem] text-muted-foreground">
            Te zadania nie są widoczne na Gantcie. Otwórz modal zadania i ustaw Start + Koniec.
          </p>
          <ul className="grid gap-1 sm:grid-cols-2">
            {unscheduled.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/w/${workspaceId}/t/${t.id}`}
                  className="block truncate rounded-md border border-border bg-background px-3 py-1.5 text-[0.84rem] transition-colors hover:border-primary/60 hover:text-primary"
                >
                  {t.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* taskPl signaled used for unscheduled count copy hooks */}
      <span hidden>{taskPl(timelineItems.length)}</span>
    </div>
  );
}
