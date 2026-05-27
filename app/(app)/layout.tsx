import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Sidebar } from "@/components/layout/sidebar";
import type { SidebarWorkspace } from "@/components/layout/sidebar";
import { parseEnabledViews } from "@/lib/board-views";
import { ReminderPopups } from "@/components/reminders/reminder-popups";
import { NotificationToaster } from "@/components/notifications/notification-toaster";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/secure-access-portal");

  // Fresh user read — JWT session is cached, DB is source of truth for avatar/name.
  const [user, memberships, unreadNotifs, openSupportTickets, dueReminders] = await Promise.all([
    db.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true, name: true, avatarUrl: true, isSuperAdmin: true },
    }),
    db.workspaceMembership.findMany({
      where: { userId: session.user.id, workspace: { deletedAt: null } },
      include: {
        workspace: {
          include: {
            // Fetch all boards unrestricted; filter per role below
            // (ADMIN sees all, MEMBER/VIEWER sees PUBLIC + explicit memberships).
            boards: {
              where: { deletedAt: null },
              orderBy: [{ order: "asc" }, { createdAt: "asc" }],
              select: {
                id: true,
                name: true,
                visibility: true,
                memberships: {
                  where: { userId: session.user.id },
                  select: { id: true },
                },
              },
            },
          },
        },
      },
      // Order by workspace.order (user-set) instead of joinedAt.
      orderBy: [
        { workspace: { order: "asc" } },
        { workspace: { createdAt: "asc" } },
      ],
    }),
    db.notification.count({
      where: { userId: session.user.id, readAt: null },
    }),
    // Active support ticket counts (OPEN + IN_PROGRESS) per workspace for
    // the sidebar badge. Single groupBy avoids N+1 over workspaces.
    db.supportTicket.groupBy({
      by: ["workspaceId"],
      where: {
        status: { in: ["OPEN", "IN_PROGRESS"] },
        workspace: {
          deletedAt: null,
          memberships: { some: { userId: session.user.id } },
        },
      },
      _count: true,
    }),
    // Due, undismissed reminder popups; capped to prevent a runaway creator
    // from DoSing the recipient's top-right corner.
    db.personalReminder.findMany({
      where: {
        recipientId: session.user.id,
        dueAt: { lte: new Date() },
        dismissedAt: null,
      },
      orderBy: { dueAt: "asc" },
      take: 5,
      include: {
        creator: { select: { id: true, name: true, email: true } },
      },
    }),
  ]);
  if (!user) redirect("/secure-access-portal");

  const supportCountByWs = new Map<string, number>(
    openSupportTickets.map((row) => [
      row.workspaceId,
      typeof row._count === "number" ? row._count : 0,
    ]),
  );

  const workspaces: SidebarWorkspace[] = memberships.map((m) => {
    // ADMINs see all boards; others see PUBLIC + explicit memberships.
    const visibleBoards = m.workspace.boards.filter((b) => {
      if (m.role === "ADMIN") return true;
      if (b.visibility === "PUBLIC") return true;
      return b.memberships.length > 0;
    });
    return {
      id: m.workspace.id,
      name: m.workspace.name,
      slug: m.workspace.slug,
      role: m.role,
      boards: visibleBoards.map((b) => ({ id: b.id, name: b.name })),
      // Sidebar expects uppercase ViewType.
      enabledViews: parseEnabledViews(m.workspace.enabledViews).map((v) =>
        v.toUpperCase(),
      ) as SidebarWorkspace["enabledViews"],
      openSupportCount: supportCountByWs.get(m.workspace.id) ?? 0,
    };
  });

  return (
    // Subtle radial gradient gives the sidebar glass something to blur over
    // — flat color makes the glass look flat. Theme-independent.
    <div
      style={{
        background:
          "radial-gradient(900px 600px at 18% 30%, rgba(124,92,255,0.10), transparent 60%), radial-gradient(700px 500px at 85% 70%, rgba(255,156,230,0.05), transparent 60%), var(--background)",
      }}
      className="flex min-h-dvh"
    >
      <Sidebar
        user={{
          id: user.id,
          email: user.email,
          name: user.name,
          avatarUrl: user.avatarUrl,
          isSuperAdmin: user.isSuperAdmin,
        }}
        workspaces={workspaces}
        unreadNotificationCount={unreadNotifs}
      />
      {/* max-md:pt-14 clears the fixed hamburger (top-3 h-11) on mobile so
          page h1s aren't hidden behind it. Desktop sidebar is inline so no padding. */}
      <div className="flex min-w-0 flex-1 flex-col max-md:pt-14">{children}</div>

      <ReminderPopups
        userId={user.id}
        initial={dueReminders.map((r) => ({
          id: r.id,
          title: r.title,
          body: r.body,
          creatorName: r.creator.name ?? r.creator.email,
          isSelfAuthored: r.creator.id === session.user.id,
        }))}
      />
      {/* Global notification toaster (mention/assign/poll/support). Independent
          from ReminderPopups — different data source (Notification vs PersonalReminder). */}
      <NotificationToaster userId={user.id} />
    </div>
  );
}
