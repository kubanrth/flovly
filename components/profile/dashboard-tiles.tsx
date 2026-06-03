import Link from "next/link";
import { ArrowRight, CheckCircle, KanbanSquare, Layers, ListTodo } from "lucide-react";

// "Done-ish" heuristic — there's no explicit isClosed on StatusColumn, so we
// match common Polish + English completion names. Used both for breakdown
// labels and the "closed this month" team table column.
const DONE_NAME_RE = /done|gotowe|wykonane|zako[nń]czon|zamkni|complete/i;

export function isDoneStatus(name: string | null | undefined): boolean {
  return typeof name === "string" && DONE_NAME_RE.test(name);
}

export interface DashboardSummary {
  myActiveTasks: number;
  myBoards: number;
  myTasksClosedThisMonth: number;
  statusBreakdown: { id: string; name: string; colorHex: string; count: number }[];
}

export function DashboardTiles({ summary }: { summary: DashboardSummary }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <Tile
        label="Moje aktywne zadania"
        value={summary.myActiveTasks}
        icon={<ListTodo size={14} />}
        href="/my-tasks"
        accent="from-violet-500/15 to-violet-500/0"
      />
      <Tile
        label="Moje tablice"
        value={summary.myBoards}
        icon={<KanbanSquare size={14} />}
        href="/workspaces"
        accent="from-sky-500/15 to-sky-500/0"
      />
      <Tile
        label="Zamknięte w tym miesiącu"
        value={summary.myTasksClosedThisMonth}
        icon={<CheckCircle size={14} />}
        accent="from-emerald-500/15 to-emerald-500/0"
      />
      <Tile
        label="Liczba statusów z taskami"
        value={summary.statusBreakdown.length}
        icon={<Layers size={14} />}
        accent="from-amber-500/15 to-amber-500/0"
      />
    </div>
  );
}

function Tile({
  label,
  value,
  icon,
  href,
  accent,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  href?: string;
  // Tailwind gradient classes for the corner accent.
  accent: string;
}) {
  const body = (
    <div className="relative flex h-full flex-col gap-2 overflow-hidden rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40">
      <div
        aria-hidden
        className={`pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-to-br ${accent} blur-2xl`}
      />
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </span>
        <span className="grid h-7 w-7 place-items-center rounded-md bg-muted/60 text-muted-foreground">
          {icon}
        </span>
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-display text-[2rem] font-bold tabular-nums leading-none tracking-[-0.03em]">
          {value}
        </span>
        {href && (
          <span className="inline-flex items-center gap-1 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground">
            otwórz <ArrowRight size={10} />
          </span>
        )}
      </div>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export function StatusBreakdown({
  items,
}: {
  items: { id: string; name: string; colorHex: string; count: number }[];
}) {
  if (items.length === 0) {
    return (
      <p className="rounded-md border border-border bg-card px-4 py-6 text-center text-[0.86rem] text-muted-foreground">
        Brak zadań w statusach.
      </p>
    );
  }
  const total = items.reduce((s, it) => s + it.count, 0);
  return (
    <ul className="flex flex-col gap-2">
      {items.map((s) => {
        const pct = total > 0 ? Math.round((s.count / total) * 100) : 0;
        return (
          <li
            key={s.id}
            className="flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2"
          >
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: s.colorHex }}
              aria-hidden
            />
            <span className="min-w-0 flex-1 truncate text-[0.88rem]">{s.name}</span>
            <span className="font-mono text-[0.7rem] text-muted-foreground">
              {pct}%
            </span>
            <span className="shrink-0 rounded-full bg-muted/50 px-2 py-0.5 font-mono text-[0.68rem] font-semibold tabular-nums">
              {s.count}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
