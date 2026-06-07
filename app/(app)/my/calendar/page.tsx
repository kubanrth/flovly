import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  CalendarMonthGrid,
  type CalendarEvent,
} from "@/components/my/calendar/month-grid";
import { CalendarWorkspaceFilter } from "@/components/my/calendar/workspace-filter";
import { AppShell } from "@/components/layout/app-shell";

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
    workspaceId: a.task.workspace.id,
    workspaceName: a.task.workspace.name,
    boardName: a.task.board.name,
    statusColor: a.task.statusColumn?.colorHex ?? null,
    startAt: a.task.startAt ? a.task.startAt.toISOString() : null,
    stopAt: a.task.stopAt ? a.task.stopAt.toISOString() : null,
  }));

  // Vacations — user's own (approved + pending so they see what they
  // requested) + teammates' APPROVED only (don't leak pending plans).
  // Color hint distinguishes own (sky) vs teammate (slate) at a glance.
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
      title: isMine ? "Twój urlop" : `${who}`,
      workspaceId: "vacation",
      workspaceName: "Urlopy",
      boardName: isMine ? "Twój" : who,
      statusColor: isMine ? "#0EA5E9" : "#64748B",
      startAt: v.startDate.toISOString(),
      stopAt: v.endDate.toISOString(),
      kind: "vacation",
      entityId: v.id,
    });
  }

  return (
    <AppShell>
      <div className="mb-6 flex flex-col gap-2">
        <span className="eyebrow">Twój kalendarz</span>
        <h1 className="font-display text-[2.2rem] font-bold leading-[1.1] tracking-[-0.03em]">
          Co masz <span className="text-brand-gradient">na osi</span>.
        </h1>
        <p className="max-w-[60ch] text-[0.95rem] leading-[1.55] text-muted-foreground">
          Wszystkie zadania, w których jesteś assignee, na siatce miesiąca.
          Klik = otwarcie karty zadania.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-end gap-3">
        <CalendarWorkspaceFilter
          workspaces={availableWorkspaces}
          selected={selectedWorkspace}
        />
      </div>

      <CalendarMonthGrid events={events} />
    </AppShell>
  );
}
