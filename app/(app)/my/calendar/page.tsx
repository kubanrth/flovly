import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { CalendarEvent } from "@/components/my/calendar/month-grid";
import { MyCalendarWorkspace } from "@/components/my/calendar/calendar-workspace";

export default async function MyCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ workspace?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/secure-access-portal");
  const userId = session.user.id;
  const params = await searchParams;
  // `?workspace=all` (or omitted) shows everything; any other value scopes to that workspace id.
  const selectedWorkspace = params.workspace ?? "all";

  const memberships = await db.workspaceMembership.findMany({
    where: { userId, workspace: { deletedAt: null } },
    include: { workspace: { select: { id: true, name: true } } },
    orderBy: { joinedAt: "asc" },
  });
  const availableWorkspaces = memberships.map((m) => ({
    id: m.workspace.id,
    name: m.workspace.name,
  }));

  // Every dated assignment. Filter on workspace.deletedAt + board.deletedAt
  // since soft-delete doesn't cascade to tasks — otherwise "all workspaces"
  // would leak tasks from deleted ones.
  const assignments = await db.taskAssignee.findMany({
    where: {
      userId,
      task: {
        deletedAt: null,
        workspace: { deletedAt: null },
        board: { deletedAt: null },
        ...(selectedWorkspace !== "all"
          ? { workspaceId: selectedWorkspace }
          : {}),
        OR: [{ startAt: { not: null } }, { stopAt: { not: null } }],
      },
    },
    include: {
      task: {
        include: {
          workspace: { select: { id: true, name: true } },
          board: { select: { name: true } },
          statusColumn: { select: { colorHex: true } },
        },
      },
    },
  });

  const events: CalendarEvent[] = assignments.map((a) => ({
    id: a.task.id,
    title: a.task.title,
    displayId: a.task.displayId,
    workspaceId: a.task.workspace.id,
    workspaceName: a.task.workspace.name,
    boardName: a.task.board.name,
    // D4: kolor bierze się ze źródła (termin = niebieski), nie ze statusu.
    statusColor: null,
    startAt: a.task.startAt ? a.task.startAt.toISOString() : null,
    stopAt: a.task.stopAt ? a.task.stopAt.toISOString() : null,
    kind: "task",
  }));

  // Przypomnienia osobiste, których jestem odbiorcą (te ukryte z listy
  // /my/reminders nie wracają tylnymi drzwiami w kalendarzu).
  const reminders = await db.personalReminder.findMany({
    where: { recipientId: userId, recipientHiddenAt: null },
    select: { id: true, title: true, dueAt: true },
    orderBy: { dueAt: "asc" },
  });

  for (const r of reminders) {
    events.push({
      id: `reminder:${r.id}`,
      entityId: r.id,
      title: r.title,
      workspaceId: "reminder",
      workspaceName: "Przypomnienia",
      boardName: "Przypomnienie",
      statusColor: null,
      startAt: null,
      stopAt: r.dueAt.toISOString(),
      kind: "reminder",
    });
  }

  // Vacations — user's own (approved + pending so they see what they
  // requested) + teammates' APPROVED only (don't leak pending plans).
  const workspaceIds = memberships.map((m) => m.workspaceId);
  const teammateIds = (
    await db.workspaceMembership.findMany({
      where: { workspaceId: { in: workspaceIds }, userId: { not: userId } },
      distinct: ["userId"],
      select: { userId: true },
    })
  ).map((m) => m.userId);

  const vacations = await db.vacationRequest.findMany({
    where: {
      OR: [
        { requesterId: userId, status: { in: ["pending", "approved"] } },
        { requesterId: { in: teammateIds }, status: "approved" },
      ],
    },
    include: {
      requester: { select: { id: true, name: true, email: true } },
    },
  });

  for (const v of vacations) {
    const isMine = v.requesterId === userId;
    const who = v.requester.name ?? v.requester.email;
    events.push({
      id: `vacation:${v.id}`,
      title: isMine ? "Twój urlop" : `Urlop: ${who}`,
      workspaceId: "vacation",
      workspaceName: "Urlopy",
      boardName: isMine ? "Twój" : who,
      statusColor: null,
      startAt: v.startDate.toISOString(),
      stopAt: v.endDate.toISOString(),
      kind: "vacation",
      entityId: v.id,
    });
  }

  return (
    <div className="flex h-[calc(100dvh-var(--topbar))] min-h-0 flex-col bg-card">
      <MyCalendarWorkspace
        events={events}
        workspaces={availableWorkspaces}
        selectedWorkspace={selectedWorkspace}
      />
    </div>
  );
}
