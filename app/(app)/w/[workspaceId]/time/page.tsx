import { db } from "@/lib/db";
import { requireWorkspaceMembership } from "@/lib/workspace-guard";
import { can } from "@/lib/permissions";
import { coversDay } from "@/components/vacations/leave";
import { TimesheetView, type TimesheetPerson, type RunningTimer } from "@/components/time/timesheet-view";
import { addDays, dayKey, parseWeek, weekDays, type TimeEntryRow } from "@/components/time/time-math";

// E2 „Czas pracy" — tydzień Pon–Nd, siatka osoba × dzień. `?view=my` zawęża do
// zalogowanego użytkownika, `?week=YYYY-MM-DD` wskazuje dowolny tydzień.
export default async function TimeTrackingPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string }>;
  searchParams: Promise<{ week?: string; view?: string; new?: string }>;
}) {
  const { workspaceId } = await params;
  const { week, view: rawView, new: openNew } = await searchParams;
  const ctx = await requireWorkspaceMembership(workspaceId);
  const view = rawView === "my" ? "my" : "team";

  const weekStart = parseWeek(week, new Date());
  const weekEnd = addDays(weekStart, 7);
  const days = weekDays(weekStart);

  const [entries, memberships, running] = await Promise.all([
    db.timeEntry.findMany({
      where: {
        workspaceId,
        deletedAt: null,
        startedAt: { gte: weekStart, lt: weekEnd },
        ...(view === "my" ? { userId: ctx.userId } : {}),
      },
      orderBy: { startedAt: "asc" },
      include: {
        task: { select: { title: true, displayId: true, board: { select: { id: true, name: true } } } },
        user: { select: { id: true, name: true, email: true } },
      },
    }),
    db.workspaceMembership.findMany({
      where: { workspaceId, ...(view === "my" ? { userId: ctx.userId } : {}) },
      orderBy: { joinedAt: "asc" },
      select: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    }),
    // Kafel „Timer aktywny" — pokazujemy najświeższy biegnący timer przestrzeni.
    db.task.findFirst({
      where: { workspaceId, deletedAt: null, timerStartedAt: { not: null } },
      orderBy: { timerStartedAt: "desc" },
      select: { id: true, title: true, displayId: true, timerStartedAt: true },
    }),
  ]);

  const memberIds = memberships.map((m) => m.user.id);

  // Urlopy → zielone komórki URLOP. Zatwierdzone wnioski osób z tej przestrzeni,
  // przycięte do wyświetlanego tygodnia.
  const leaves = memberIds.length
    ? await db.vacationRequest.findMany({
        where: {
          status: "approved",
          requesterId: { in: memberIds },
          startDate: { lt: weekEnd },
          endDate: { gte: weekStart },
        },
        select: { requesterId: true, startDate: true, endDate: true },
      })
    : [];

  // Task nie zna właściciela timera — bierzemy aktora ostatniego `task.timerStarted`.
  const timerActor = running
    ? await db.auditLog.findFirst({
        where: { workspaceId, objectType: "Task", objectId: running.id, action: "task.timerStarted" },
        orderBy: { createdAt: "desc" },
        select: { actorId: true, actor: { select: { name: true, email: true } } },
      })
    : null;

  const people: TimesheetPerson[] = memberships.map((m) => ({
    id: m.user.id,
    name: m.user.name ?? m.user.email,
    avatarUrl: m.user.avatarUrl,
    leaveDays: days
      .map(dayKey)
      .filter((key) =>
        leaves.some(
          (l) =>
            l.requesterId === m.user.id &&
            coversDay(
              { startDate: l.startDate.toISOString(), endDate: l.endDate.toISOString() },
              `${key}T00:00:00.000Z`,
            ),
        ),
      ),
  }));

  const timer: RunningTimer | null =
    running && running.timerStartedAt
      ? {
          taskId: running.id,
          taskDisplayId: running.displayId,
          taskTitle: running.title,
          ownerId: timerActor?.actorId ?? null,
          ownerName: timerActor?.actor?.name ?? timerActor?.actor?.email ?? "—",
          startedAt: running.timerStartedAt.toISOString(),
        }
      : null;

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
    <TimesheetView
      workspaceId={workspaceId}
      currentUserId={ctx.userId}
      canApprove={can(ctx.role, "workspace.updateSettings")}
      canPauseTimer={can(ctx.role, "task.update")}
      view={view}
      weekKey={dayKey(weekStart)}
      todayKey={dayKey(new Date())}
      entries={rows}
      people={people}
      timer={timer}
      openNewEntry={openNew === "1"}
    />
  );
}
