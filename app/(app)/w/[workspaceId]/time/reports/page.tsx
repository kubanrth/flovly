import Link from "next/link";
import { db } from "@/lib/db";
import { requireWorkspaceMembership } from "@/lib/workspace-guard";
import { ReportsView } from "@/components/time/reports-view";

// F12-K133: raporty time tracking. Grupowanie:
//   - per user
//   - per task (top X by time)
//   - per board (top X)
// Filtr: date range (default: this month), billable only.
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
  const billableOnly = billable === "true";

  const entries = await db.timeEntry.findMany({
    where: {
      workspaceId,
      deletedAt: null,
      startedAt: { gte: rangeStart, lt: rangeEnd },
      ...(billableOnly ? { billable: true } : {}),
    },
    include: {
      task: {
        select: {
          id: true,
          title: true,
          displayId: true,
          board: { select: { id: true, name: true } },
        },
      },
      user: { select: { id: true, name: true, email: true, avatarUrl: true } },
    },
    orderBy: { startedAt: "desc" },
  });

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 py-6 md:py-10">
      <header className="flex flex-col gap-2">
        <span className="eyebrow">Raporty · Czas pracy</span>
        <div className="flex flex-wrap items-baseline gap-4">
          <h1 className="font-display text-[2rem] font-bold leading-tight tracking-[-0.025em] md:text-[2.4rem]">
            Raporty czasu
          </h1>
          <Link
            href={`/w/${workspaceId}/time`}
            className="text-[0.86rem] text-muted-foreground underline decoration-dashed underline-offset-4 hover:text-primary"
          >
            ← Timesheet
          </Link>
        </div>
      </header>

      <ReportsView
        workspaceId={workspaceId}
        rangeStartIso={rangeStart.toISOString()}
        rangeEndIso={rangeEnd.toISOString()}
        billableOnly={billableOnly}
        entries={entries.map((e) => ({
          id: e.id,
          durationSeconds: e.durationSeconds,
          billable: e.billable,
          rateSnapshotCents: e.rateSnapshotCents,
          note: e.note,
          approvedAt: e.approvedAt?.toISOString() ?? null,
          startedAt: e.startedAt.toISOString(),
          userId: e.userId,
          userName: e.user.name ?? e.user.email,
          userAvatar: e.user.avatarUrl,
          taskId: e.taskId,
          taskTitle: e.task?.title ?? null,
          taskDisplayId: e.task?.displayId ?? null,
          boardId: e.task?.board?.id ?? null,
          boardName: e.task?.board?.name ?? null,
        }))}
      />
    </div>
  );
}

function parseRange(from?: string, to?: string): [Date, Date] {
  const now = new Date();
  const start = from ? new Date(from) : new Date(now.getFullYear(), now.getMonth(), 1);
  const end = to
    ? new Date(to)
    : new Date(now.getFullYear(), now.getMonth() + 1, 1);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return [
      new Date(now.getFullYear(), now.getMonth(), 1),
      new Date(now.getFullYear(), now.getMonth() + 1, 1),
    ];
  }
  return [start, end];
}
