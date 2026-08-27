import { db } from "@/lib/db";
import { requireWorkspaceMembership } from "@/lib/workspace-guard";
import { ReportsView } from "@/components/time/reports-view";
import type { TimeEntryRow } from "@/components/time/time-math";

// E2 / segment „Raport" — roll-upy wg osoby / zadania / tablicy w zakresie dat
// (domyślnie bieżący miesiąc), opcjonalnie tylko wpisy fakturowane.
export default async function TimeReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string }>;
  searchParams: Promise<{ from?: string; to?: string; billable?: string }>;
}) {
  const { workspaceId } = await params;
  const { from, to, billable } = await searchParams;
  await requireWorkspaceMembership(workspaceId);

  const [rangeStart, rangeEnd] = parseRange(from, to);
  const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const billableOnly = billable === "true";

  const entries = await db.timeEntry.findMany({
    where: {
      workspaceId,
      deletedAt: null,
      startedAt: { gte: rangeStart, lt: rangeEnd },
      ...(billableOnly ? { billable: true } : {}),
    },
    orderBy: { startedAt: "desc" },
    include: {
      task: { select: { title: true, displayId: true, board: { select: { id: true, name: true } } } },
      user: { select: { name: true, email: true } },
    },
  });

  const rows: TimeEntryRow[] = entries.map((e) => ({
    id: e.id,
    userId: e.userId,
    userName: e.user.name ?? e.user.email,
    taskId: e.taskId,
    taskDisplayId: e.task?.displayId ?? null,
    taskTitle: e.task?.title ?? null,
    boardId: e.task?.board?.id ?? null,
    boardName: e.task?.board?.name ?? null,
    note: e.note,
    startedAt: e.startedAt.toISOString(),
    durationSeconds: e.durationSeconds,
    billable: e.billable,
    approvedAt: e.approvedAt?.toISOString() ?? null,
  }));

  return (
    <ReportsView
      workspaceId={workspaceId}
      from={key(rangeStart)}
      to={key(new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), rangeEnd.getDate() - 1))}
      billableOnly={billableOnly}
      entries={rows}
    />
  );
}

/** `?from`/`?to` jako `YYYY-MM-DD`; brak lub śmieci → bieżący miesiąc. `to` jest włącznie. */
function parseRange(from?: string, to?: string): [Date, Date] {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const start = parseDay(from) ?? monthStart;
  const end = parseDay(to);
  const exclusiveEnd = end ? new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1) : monthEnd;
  return exclusiveEnd > start ? [start, exclusiveEnd] : [monthStart, monthEnd];
}

function parseDay(value?: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((value ?? "").trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}
