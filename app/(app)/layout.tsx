import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Suspense } from "react";
import { AppFrame } from "@/components/layout/app-frame";
import type { ShellBoard, SidebarWorkspace } from "@/components/layout/shell-types";
import { parseEnabledViews } from "@/lib/board-views";
import { ReminderPopups } from "@/components/reminders/reminder-popups";
import { NotificationToaster } from "@/components/notifications/notification-toaster";
import { CommandPalette } from "@/components/search/command-palette";
import type { CommandPaletteData } from "@/components/search/command-palette";
import { OnboardingTour } from "@/components/onboarding/onboarding-tour";
import { RouteTracker } from "@/components/layout/route-tracker";
import { RouteFrame } from "@/components/layout/route-frame";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/secure-access-portal");
  const userId = session.user.id;

  // Fresh user read — JWT session is cached, DB is source of truth for avatar/name.
  const [user, memberships, unreadNotifs, openSupportTickets, dueReminders, myTasksCount, myAssignedTasks] =
    await Promise.all([
      db.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, name: true, avatarUrl: true, isSuperAdmin: true, onboardingCompletedAt: true },
      }),
      db.workspaceMembership.findMany({
        where: { userId, workspace: { deletedAt: null } },
        include: {
          workspace: {
            include: {
              // All boards; filtered per role below (ADMIN all, else PUBLIC + explicit membership).
              boards: {
                where: { deletedAt: null },
                orderBy: [{ order: "asc" }, { createdAt: "asc" }],
                select: { id: true, name: true, visibility: true, memberships: { where: { userId }, select: { id: true } } },
              },
            },
          },
        },
        orderBy: [{ workspace: { order: "asc" } }, { workspace: { createdAt: "asc" } }],
      }),
      db.notification.count({ where: { userId, readAt: null } }),
      db.supportTicket.groupBy({
        by: ["workspaceId"],
        where: { status: { in: ["OPEN", "IN_PROGRESS"] }, workspace: { deletedAt: null, memberships: { some: { userId } } } },
        _count: true,
      }),
      db.personalReminder.findMany({
        where: { recipientId: userId, dueAt: { lte: new Date() }, dismissedAt: null },
        orderBy: { dueAt: "asc" },
        take: 5,
        include: { creator: { select: { id: true, name: true, email: true } } },
      }),
      // Sidebar badge "Zadania dla Ciebie": assigned tasks not in the last status column
      // of their board (K91 heuristic — schema has no isDone flag; mirrors /my-tasks).
      db.task
        .findMany({
          where: { assignees: { some: { userId } }, deletedAt: null, board: { deletedAt: null, workspace: { deletedAt: null } } },
          select: { statusColumn: { select: { order: true } }, board: { select: { statusColumns: { select: { order: true } } } } },
        })
        .then((rows) =>
          rows.filter((r) => {
            if (!r.statusColumn) return true;
            const max = Math.max(-1, ...r.board.statusColumns.map((c) => c.order));
            return r.statusColumn.order !== max;
          }).length,
        ),
      // Top 5 for Cmd+K (K85).
      db.task.findMany({
        where: { assignees: { some: { userId } }, deletedAt: null, board: { deletedAt: null, workspace: { deletedAt: null } } },
        orderBy: { updatedAt: "desc" },
        take: 5,
        select: { id: true, title: true, boardId: true, workspaceId: true, workspace: { select: { name: true } } },
      }),
    ]);
  if (!user) redirect("/secure-access-portal");

  const supportCountByWs = new Map<string, number>(
    openSupportTickets.map((row) => [row.workspaceId, typeof row._count === "number" ? row._count : 0]),
  );

  const workspaces: SidebarWorkspace[] = memberships.map((m) => {
    const visibleBoards = m.workspace.boards.filter(
      (b) => m.role === "ADMIN" || b.visibility === "PUBLIC" || b.memberships.length > 0,
    );
    return {
      id: m.workspace.id,
      name: m.workspace.name,
      slug: m.workspace.slug,
      role: m.role,
      boards: visibleBoards.map((b) => ({ id: b.id, name: b.name })),
      enabledViews: parseEnabledViews(m.workspace.enabledViews).map((v) => v.toUpperCase()) as SidebarWorkspace["enabledViews"],
      openSupportCount: supportCountByWs.get(m.workspace.id) ?? 0,
    };
  });

  const boards: ShellBoard[] = workspaces.flatMap((w) =>
    w.boards.map((b) => ({ id: b.id, name: b.name, workspaceId: w.id, workspaceName: w.name })),
  );

  const commandPaletteData: CommandPaletteData = {
    workspaces: workspaces.map((w) => ({ id: w.id, name: w.name })),
    boards,
    tasks: myAssignedTasks.map((t) => ({
      id: t.id, title: t.title, boardId: t.boardId, workspaceId: t.workspaceId, workspaceName: t.workspace.name,
    })),
  };

  return (
    <AppFrame
      user={{ id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl, isSuperAdmin: user.isSuperAdmin }}
      workspaces={workspaces}
      boards={boards}
      unreadNotificationCount={unreadNotifs}
      myTasksCount={myTasksCount}
    >
      <RouteFrame>{children}</RouteFrame>

      <ReminderPopups
        userId={user.id}
        initial={dueReminders.map((r) => ({
          id: r.id, title: r.title, body: r.body,
          creatorName: r.creator.name ?? r.creator.email,
          isSelfAuthored: r.creator.id === userId,
        }))}
      />
      <NotificationToaster userId={user.id} />
      <CommandPalette data={commandPaletteData} />
      {user.onboardingCompletedAt === null && <OnboardingTour />}
      {/* K135: last non-task path + scroll for TaskModalShell return-to. */}
      <Suspense fallback={null}>
        <RouteTracker />
      </Suspense>
    </AppFrame>
  );
}
