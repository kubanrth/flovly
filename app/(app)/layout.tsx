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

  // Read fresh User to ensure sidebar avatar/name reflect recent profile changes
  // (JWT session is cached; DB is source of truth).
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
            // F12-K8: filter boards user can actually see. Workspace
            // ADMIN sees all (handled below — fetch unrestricted then
            // gate per role). For MEMBER/VIEWER: only PUBLIC boards or
            // ones they have explicit BoardMembership on.
            // F12-K52: orderBy: order (drag-drop reorder), createdAt fallback.
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
      // F12-K52: orderBy workspace.order zamiast joinedAt — sidebar
      // pokazuje workspace'y w kolejności ustawionej przez user'a.
      orderBy: [
        { workspace: { order: "asc" } },
        { workspace: { createdAt: "asc" } },
      ],
    }),
    db.notification.count({
      where: { userId: session.user.id, readAt: null },
    }),
    // F12-K38: licznik aktywnych zgłoszeń supportu per workspace, do
    // badge'a w sidebar'ze. OPEN+IN_PROGRESS — RESOLVED/CLOSED nie są
    // 'do załatwienia'. Group-by jest jednym zapytaniem niezależnie od
    // liczby workspace'ów (vs N+1 count per ws).
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
    // Active reminder popups — due + not dismissed. Capped so a runaway
    // creator can't DoS the recipient's top-right corner.
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
    // F12-K8: per-board visibility filter. ADMINs bypass; everyone else
    // sees PUBLIC boards + boards where they have an explicit membership.
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
      // Map lowercase ViewName → uppercase ViewType expected by sidebar.
      enabledViews: parseEnabledViews(m.workspace.enabledViews).map((v) =>
        v.toUpperCase(),
      ) as SidebarWorkspace["enabledViews"],
      openSupportCount: supportCountByWs.get(m.workspace.id) ?? 0,
    };
  });

  return (
    <div className="flex min-h-dvh">
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
      {/* F12-K57: max-md:pt-14 (56px) clear'uje fixed hamburger (top-3 h-11
          = y:12-56) na mobile — bez tego h1 nagłówków na każdej stronie
          chowało się pod przyciskiem. Desktop sidebar inline'owy nie używa
          hamburger'a, więc md+ bez paddingu. */}
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
      {/* F12-K35: globalny toast dla nowych notyfikacji (mention/assign/
          poll/support). Niezależny od `<ReminderPopups>` — różne źródła
          danych (Notification vs PersonalReminder), różne UX. */}
      <NotificationToaster userId={user.id} />
    </div>
  );
}
