import type { ReactNode } from "react";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { IconRoadmap } from "@/components/ui/icons";
import { hueForColor } from "@/components/ui/status-hue";
import type { ChipHue } from "@/components/ui/chip";
import { taskPl } from "@/lib/pluralize";
import { cn } from "@/lib/utils";
import type { Summary } from "@/components/summary/aggregate";

// B8 „Podsumowanie” — read-only board dashboard. Every number comes from
// `summarize()`; nothing here fetches or mutates.

export interface ActivityEntry {
  id: string;
  actorName: string;
  actorAvatarUrl: string | null;
  /** Verb phrase, already conjugated, e.g. „skomentował(a)”. */
  phrase: string;
  /** Task referenced by the entry, when it belongs to this board. */
  task: { id: string; displayId: number } | null;
  time: string;
}

// Saturated bar/dot colour per chip hue — same pairs the `Chip` dot uses.
// ponytail: duplicated because `components/ui/chip.tsx` keeps its DOT map private.
const HUE_BAR: Record<ChipHue, string> = {
  gray: "bg-n-500", orange: "bg-orange-500", red: "bg-danger", yellow: "bg-warning", green: "bg-success",
  teal: "bg-chip-teal-fg", blue: "bg-info", indigo: "bg-chip-indigo-fg", purple: "bg-chip-purple-fg",
  pink: "bg-chip-pink-fg", brown: "bg-chip-brown-fg", black: "bg-n-900",
};

const LINK = "rounded-[2px] text-orange-700 no-underline outline-none hover:text-orange-800 hover:underline active:text-orange-900";

function Card({ title, meta, children }: { title: string; meta?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        {meta && <span className="ml-auto">{meta}</span>}
      </div>
      {children}
    </section>
  );
}

function Kpi({ label, value, unit, danger, sub }: { label: string; value: string; unit: string; danger?: boolean; sub?: ReactNode }) {
  return (
    <div data-ui="summary-kpi" className="rounded-lg border border-border bg-card px-4 py-3.5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className={cn("text-xl font-semibold tracking-[-0.3px]", danger && "text-danger-text")}>{value}</span>
        <span className="text-xs text-n-500">{unit}</span>
      </div>
      {sub && <div className="mt-0.5 text-2xs">{sub}</div>}
    </div>
  );
}

const Muted = ({ children }: { children: ReactNode }) => <p className="text-xs text-n-500">{children}</p>;

export function BoardSummary({
  workspaceId,
  boardId,
  summary,
  activity,
  generatedAt,
}: {
  workspaceId: string;
  boardId: string;
  summary: Summary;
  activity: ActivityEntry[];
  generatedAt: string;
}) {
  const { total, done, inProgress, overdue, statuses, workload, milestones } = summary;

  return (
    <div data-ui="board-summary" className="-mx-6 -my-4 flex flex-1 flex-col max-md:-mx-4">
      <div className="flex-1 bg-canvas px-6 py-4 max-md:px-4">
        <div className="mb-3 grid grid-cols-3 gap-3 max-md:grid-cols-1">
          <Kpi label="Ukończone" value={String(done)} unit={`z ${total}`} />
          <Kpi label="W toku" value={String(inProgress)} unit={taskPl(inProgress)} />
          <Kpi
            label="Po terminie"
            value={String(overdue.length)}
            unit={taskPl(overdue.length)}
            danger
            sub={
              overdue.length > 0 ? (
                <span className="text-danger-text">
                  {overdue.slice(0, 6).map((t, i) => (
                    <span key={t.id}>
                      {i > 0 && <span className="text-n-400"> · </span>}
                      <Link href={`/w/${workspaceId}/t/${t.id}`} className="rounded-[2px] text-danger-text no-underline outline-none hover:underline">
                        #{t.displayId}
                      </Link>
                    </span>
                  ))}
                  {overdue.length > 6 && <span className="text-n-500"> +{overdue.length - 6}</span>}
                </span>
              ) : null
            }
          />
        </div>

        <div className="mb-3 grid grid-cols-2 gap-3 max-md:grid-cols-1">
          <Card title="Statusy" meta={<span className="font-mono text-2xs text-n-500">{total} {taskPl(total)}</span>}>
            {total === 0 ? (
              <Muted>Brak zadań na tablicy.</Muted>
            ) : (
              <>
                <div className="mb-3 flex h-3 overflow-hidden rounded-md bg-n-100">
                  {statuses.map((s) => (
                    <span key={s.id} className={HUE_BAR[hueForColor(s.colorHex)]} style={{ width: `${s.share * 100}%` }} />
                  ))}
                </div>
                <ul className="flex flex-col gap-1.5">
                  {statuses.map((s) => (
                    <li key={s.id} className="flex items-center gap-2 text-xs">
                      <span className={cn("size-2 shrink-0 rounded-[2px]", HUE_BAR[hueForColor(s.colorHex)])} />
                      <span className="truncate">{s.name}</span>
                      <span className="ml-auto shrink-0 font-mono text-2xs text-muted-foreground">{s.count} · {s.pct}%</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>

          <Card title="Obciążenie zespołu" meta={<span className="font-mono text-2xs text-n-500">zadania otwarte</span>}>
            {workload.length === 0 ? (
              <Muted>Brak członków przestrzeni.</Muted>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {workload.map((p) => (
                  <li key={p.id} className="flex items-center gap-2.5">
                    <Avatar name={p.name} src={p.avatarUrl} size={24} />
                    <span className="w-14 shrink-0 truncate text-xs">{p.name}</span>
                    <span className="h-2.5 flex-1 overflow-hidden rounded-[5px] bg-n-100">
                      <span className="block h-2.5 bg-n-900" style={{ width: `${p.share * 100}%` }} />
                    </span>
                    <span className="w-3.5 shrink-0 text-right font-mono text-2xs text-muted-foreground">{p.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
          <Card
            title="Milestone'y"
            meta={
              <Link href={`/w/${workspaceId}/b/${boardId}/gantt`} className={cn(LINK, "text-xs font-medium")}>
                Oś czasu
              </Link>
            }
          >
            {milestones.length === 0 ? (
              <Muted>{"Brak milestone'ów."}</Muted>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {milestones.map((m) => (
                  <li key={m.id} className="flex items-center gap-2">
                    <IconRoadmap width={12} height={12} className="shrink-0 text-orange-700" />
                    <span className="w-30 shrink-0 truncate text-xs font-medium">{m.title}</span>
                    <span className="h-1.5 flex-1 overflow-hidden rounded-[3px] bg-n-100">
                      <span className={cn("block h-1.5", m.late ? "bg-danger" : "bg-success")} style={{ width: `${m.share * 100}%` }} />
                    </span>
                    <span className="shrink-0 font-mono text-2xs text-muted-foreground">
                      {m.done}/{m.total} · {new Date(m.stopAt).toLocaleDateString("pl-PL", { day: "numeric", month: "short" })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Ostatnia aktywność">
            {activity.length === 0 ? (
              <Muted>Brak zdarzeń.</Muted>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {activity.map((a) => (
                  <li key={a.id} className="flex gap-2 text-xs text-muted-foreground">
                    <Avatar name={a.actorName} src={a.actorAvatarUrl} size={22} className="mt-px" />
                    <span className="leading-[17px]">
                      <strong className="font-semibold text-foreground">{a.actorName}</strong> {a.phrase}
                      {a.task && (
                        <>
                          {" "}
                          <Link href={`/w/${workspaceId}/t/${a.task.id}`} className={LINK}>
                            #{a.task.displayId}
                          </Link>
                        </>
                      )}{" "}
                      <span className="font-mono text-[10px]">· {a.time}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <footer className="flex h-8 shrink-0 items-center border-t border-border bg-canvas px-6 font-mono text-2xs text-muted-foreground max-md:px-4">
        stan na dziś, {generatedAt}
      </footer>
    </div>
  );
}
