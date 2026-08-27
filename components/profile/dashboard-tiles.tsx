import Link from "next/link";
import { IconArrowRight, IconBoards, IconCheckCircle, IconTasks, IconTable } from "@/components/ui/icons";
import { hueForColor } from "@/components/ui/status-hue";
import { Chip } from "@/components/ui/chip";

// "Done-ish" heuristic — there's no explicit isClosed on StatusColumn, so we
// match common Polish + English completion names. Used both for breakdown
// labels and the "closed this month" team table column. Deliberately looser
// than components/board/done-status.ts: this one spans every workspace.
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
      <Tile label="Moje aktywne zadania" value={summary.myActiveTasks} icon={<IconTasks />} href="/my-tasks" />
      <Tile label="Moje tablice" value={summary.myBoards} icon={<IconBoards />} href="/workspaces" />
      <Tile label="Zamknięte w tym miesiącu" value={summary.myTasksClosedThisMonth} icon={<IconCheckCircle />} />
      <Tile label="Statusy z zadaniami" value={summary.statusBreakdown.length} icon={<IconTable />} />
    </div>
  );
}

function Tile({
  label,
  value,
  icon,
  href,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  href?: string;
}) {
  const body = (
    <div
      data-ui="summary-kpi"
      className="flex h-full flex-col gap-2 rounded-lg border border-border bg-card px-3.5 py-3 group-hover:border-input-border-hover"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-2xs text-fg-3">{label}</span>
        <span className="grid size-6 shrink-0 place-items-center rounded-md bg-n-100 text-fg-3 [&_svg]:size-3.5">
          {icon}
        </span>
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-lg font-semibold tabular-nums">{value}</span>
        {href && (
          <span className="inline-flex items-center gap-1 text-2xs text-fg-3 group-hover:text-orange-800">
            otwórz <IconArrowRight width={11} height={11} />
          </span>
        )}
      </div>
    </div>
  );
  return href ? (
    <Link href={href} className="group rounded-lg no-underline outline-none">
      {body}
    </Link>
  ) : (
    body
  );
}

export function StatusBreakdown({
  items,
}: {
  items: { id: string; name: string; colorHex: string; count: number }[];
}) {
  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-input-border px-3.5 py-4 text-center text-xs text-fg-2">
        Brak zadań w statusach.
      </p>
    );
  }
  const total = items.reduce((s, it) => s + it.count, 0);
  return (
    <ul className="overflow-hidden rounded-lg border border-border">
      {items.map((s) => {
        const pct = total > 0 ? Math.round((s.count / total) * 100) : 0;
        return (
          <li key={s.id} className="flex h-9 items-center gap-3 border-b border-n-100 bg-card px-3.5 last:border-b-0">
            <Chip hue={hueForColor(s.colorHex)} dot size="sm">
              {s.name}
            </Chip>
            <span className="flex-1" />
            <span className="font-mono text-2xs text-fg-3">{pct}%</span>
            <span className="font-mono text-2xs font-semibold tabular-nums">{s.count}</span>
          </li>
        );
      })}
    </ul>
  );
}
