import Link from "next/link";
import { db } from "@/lib/db";
import { requireWorkspaceMembership } from "@/lib/workspace-guard";
import { auth } from "@/lib/auth";
import { TimesheetView } from "@/components/time/timesheet-view";

// F12-K133: TimeCamp-like timesheet. Domyślnie pokazujemy AKTUALNY tydzień
// (Mon–Sun) wpisów aktualnego usera. Weekly view — 7 kolumn dni, wiersze =
// grouped by task. Total per row + per column + grand total. Manual add via
// TimeEntryDialog wewnątrz komponentu.
export default async function TimeTrackingPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string }>;
  searchParams: Promise<{ week?: string; user?: string }>;
}) {
  const { workspaceId } = await params;
  const { week, user: userFilter } = await searchParams;
  await requireWorkspaceMembership(workspaceId);
  const session = await auth();
  const currentUserId = session!.user.id;

  // Week = ISO Monday start. Default: "current week" = Monday of current week.
  const weekStart = parseWeekStart(week);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  // Filter by user (opcjonalnie — admin panel może filtrować, MVP: default =
  // aktualny user, "all" = wszyscy).
  const userWhere =
    userFilter === "all" ? {} : { userId: userFilter || currentUserId };

  const [entries, memberships, myRate] = await Promise.all([
    db.timeEntry.findMany({
      where: {
        workspaceId,
        deletedAt: null,
        startedAt: { gte: weekStart, lt: weekEnd },
        ...userWhere,
      },
      include: {
        task: { select: { id: true, title: true, displayId: true, board: { select: { name: true } } } },
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
      orderBy: [{ startedAt: "asc" }],
    }),
    db.workspaceMembership.findMany({
      where: { workspaceId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            hourlyRateCents: true,
          },
        },
      },
      orderBy: { joinedAt: "asc" },
    }),
    db.user.findUnique({
      where: { id: currentUserId },
      select: { hourlyRateCents: true },
    }),
  ]);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 py-6 md:py-10">
      <header className="flex flex-col gap-2">
        <span className="eyebrow">Czas pracy · TimeCamp-style</span>
        <div className="flex flex-wrap items-baseline gap-4">
          <h1 className="font-display text-[2rem] font-bold leading-tight tracking-[-0.025em] md:text-[2.4rem]">
            Twój tydzień
          </h1>
          <Link
            href={`/w/${workspaceId}/time/reports`}
            className="text-[0.86rem] text-muted-foreground underline decoration-dashed underline-offset-4 hover:text-primary"
          >
            → Raporty
          </Link>
        </div>
      </header>

      <TimesheetView
        workspaceId={workspaceId}
        currentUserId={currentUserId}
        weekStartIso={weekStart.toISOString()}
        entries={entries.map((e) => ({
          id: e.id,
          taskId: e.taskId,
          taskTitle: e.task?.title ?? null,
          taskDisplayId: e.task?.displayId ?? null,
          boardName: e.task?.board?.name ?? null,
          userId: e.userId,
          userName: e.user.name ?? e.user.email,
          userAvatar: e.user.avatarUrl,
          startedAt: e.startedAt.toISOString(),
          stoppedAt: e.stoppedAt.toISOString(),
          durationSeconds: e.durationSeconds,
          note: e.note,
          billable: e.billable,
          rateSnapshotCents: e.rateSnapshotCents,
          approvedAt: e.approvedAt?.toISOString() ?? null,
        }))}
        members={memberships.map((m) => ({
          id: m.user.id,
          name: m.user.name ?? m.user.email,
          email: m.user.email,
          avatarUrl: m.user.avatarUrl,
          hourlyRateCents: m.user.hourlyRateCents,
          role: m.role,
        }))}
        myHourlyRateCents={myRate?.hourlyRateCents ?? null}
        userFilter={userFilter ?? currentUserId}
      />
    </div>
  );
}

// Return ISO Monday 00:00 for a given "?week=YYYY-MM-DD" or current time.
function parseWeekStart(input: string | undefined): Date {
  const raw = input ? new Date(input) : new Date();
  if (Number.isNaN(raw.getTime())) return startOfIsoWeek(new Date());
  return startOfIsoWeek(raw);
}

function startOfIsoWeek(d: Date): Date {
  const copy = new Date(d);
  const day = copy.getDay(); // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day; // shift to Monday
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}
