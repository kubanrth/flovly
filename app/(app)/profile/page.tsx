import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ProfileForm } from "@/components/profile/profile-form";
import { TwoFactorSection } from "@/components/profile/two-factor-section";
import { ChangePasswordSection } from "@/components/profile/change-password-section";
import {
  DashboardTiles,
  StatusBreakdown,
  isDoneStatus,
  type DashboardSummary,
} from "@/components/profile/dashboard-tiles";
import {
  TeamTasksTable,
  type TeamMemberRow,
} from "@/components/profile/team-tasks-table";
import {
  ActivityFeed,
  type ActivityFeedEntry,
} from "@/components/profile/activity-feed";

export default async function ProfilePage() {
  const session = await auth();
  const user = await db.user.findUnique({ where: { id: session!.user.id } });
  if (!user) throw new Error("User not found");

  const userId = user.id;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);

  // ── Dashboard data ────────────────────────────────────────────────────────
  // All counts are cross-workspace and scoped to workspaces the user is a
  // member of (workspace.deletedAt: null).
  const [myActiveTasks, myActiveTasksByStatus, myBoardsCount, myTasksClosed] =
    await Promise.all([
      db.task.count({
        where: {
          deletedAt: null,
          assignees: { some: { userId } },
          workspace: { deletedAt: null },
        },
      }),
      // Group by status column id then resolve names/colors afterwards.
      db.task.findMany({
        where: {
          deletedAt: null,
          assignees: { some: { userId } },
          workspace: { deletedAt: null },
        },
        select: {
          statusColumnId: true,
          statusColumn: { select: { id: true, name: true, colorHex: true } },
        },
      }),
      db.board.count({
        where: {
          deletedAt: null,
          workspace: {
            deletedAt: null,
            memberships: { some: { userId } },
          },
        },
      }),
      // "Closed this month" — heuristic. We don't store an "isClosed" flag on
      // StatusColumn, so we match the column name against the done-ish regex.
      // updatedAt within the month is close enough: a task's row updates when
      // it changes status, so a row in a done-named column with this month's
      // updatedAt usually means it was just completed.
      db.task.findMany({
        where: {
          deletedAt: null,
          assignees: { some: { userId } },
          updatedAt: { gte: monthStart },
          workspace: { deletedAt: null },
          statusColumn: { isNot: null },
        },
        select: { statusColumn: { select: { name: true } } },
      }),
    ]);

  const closedThisMonth = myTasksClosed.filter((t) =>
    isDoneStatus(t.statusColumn?.name),
  ).length;

  // Aggregate status breakdown — merge same-named columns across boards so
  // "Do zrobienia" from board A and "Do zrobienia" from board B are one row.
  const statusMap = new Map<
    string,
    { id: string; name: string; colorHex: string; count: number }
  >();
  for (const t of myActiveTasksByStatus) {
    if (!t.statusColumn) continue;
    const key = t.statusColumn.name.toLowerCase();
    const existing = statusMap.get(key);
    if (existing) existing.count += 1;
    else
      statusMap.set(key, {
        id: t.statusColumn.id,
        name: t.statusColumn.name,
        colorHex: t.statusColumn.colorHex,
        count: 1,
      });
  }
  const statusBreakdown = [...statusMap.values()].sort(
    (a, b) => b.count - a.count,
  );

  const summary: DashboardSummary = {
    myActiveTasks,
    myBoards: myBoardsCount,
    myTasksClosedThisMonth: closedThisMonth,
    statusBreakdown,
  };

  // F12-K98: Twoja aktywność feed — ostatnie 25 entries z AuditLog gdzie
  // actorId == aktualny user. Scoped do workspace'ów których user jest
  // członkiem (workspace.deletedAt: null + memberships filter implicit
  // przez AuditLog → Workspace FK + RLS na poziomie query).
  const myActivityRaw = await db.auditLog.findMany({
    where: {
      actorId: userId,
      workspace: {
        deletedAt: null,
        memberships: { some: { userId } },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 25,
    select: {
      id: true,
      workspaceId: true,
      objectType: true,
      objectId: true,
      action: true,
      createdAt: true,
      workspace: { select: { name: true, slug: true } },
    },
  });

  const myActivity: ActivityFeedEntry[] = myActivityRaw.map((e) => ({
    id: e.id,
    workspaceId: e.workspaceId,
    workspaceName: e.workspace.name,
    workspaceSlug: e.workspace.slug,
    objectType: e.objectType,
    objectId: e.objectId,
    action: e.action,
    createdAt: e.createdAt,
  }));

  // ── Team table (admin / manager view) ────────────────────────────────────
  // Visible when the user is ADMIN in at least one non-deleted workspace.
  // Lists every member of those workspaces (deduped across workspaces) with
  // their active task count + closed-this-month + a deep link.
  const adminMemberships = await db.workspaceMembership.findMany({
    where: { userId, role: "ADMIN", workspace: { deletedAt: null } },
    select: { workspaceId: true },
  });
  const isManager = adminMemberships.length > 0;

  let teamRows: TeamMemberRow[] = [];
  if (isManager) {
    const adminWorkspaceIds = adminMemberships.map((m) => m.workspaceId);
    const teammateMemberships = await db.workspaceMembership.findMany({
      where: {
        workspaceId: { in: adminWorkspaceIds },
        userId: { not: userId },
        user: { isBanned: false, deletedAt: null },
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    });

    // Dedup by user id; remember the first shared workspace for the link.
    const userToWorkspace = new Map<string, string>();
    const userMap = new Map<string, TeamMemberRow>();
    for (const m of teammateMemberships) {
      if (!userToWorkspace.has(m.userId)) {
        userToWorkspace.set(m.userId, m.workspaceId);
      }
      if (!userMap.has(m.userId)) {
        userMap.set(m.userId, {
          id: m.user.id,
          name: m.user.name,
          email: m.user.email,
          avatarUrl: m.user.avatarUrl,
          activeTaskCount: 0,
          closedThisMonth: 0,
          sharedWorkspaceId: userToWorkspace.get(m.userId) ?? null,
        });
      }
    }

    const teamUserIds = [...userMap.keys()];
    if (teamUserIds.length > 0) {
      const [active, closedRows] = await Promise.all([
        db.taskAssignee.groupBy({
          by: ["userId"],
          where: {
            userId: { in: teamUserIds },
            task: {
              deletedAt: null,
              workspaceId: { in: adminWorkspaceIds },
            },
          },
          _count: { _all: true },
        }),
        // Done-named status + updatedAt in month — same heuristic as above.
        db.taskAssignee.findMany({
          where: {
            userId: { in: teamUserIds },
            task: {
              deletedAt: null,
              updatedAt: { gte: monthStart },
              workspaceId: { in: adminWorkspaceIds },
              statusColumn: { isNot: null },
            },
          },
          select: {
            userId: true,
            task: { select: { statusColumn: { select: { name: true } } } },
          },
        }),
      ]);

      for (const a of active) {
        const row = userMap.get(a.userId);
        if (row) row.activeTaskCount = a._count._all;
      }
      for (const c of closedRows) {
        if (!isDoneStatus(c.task.statusColumn?.name)) continue;
        const row = userMap.get(c.userId);
        if (row) row.closedThisMonth += 1;
      }
    }

    teamRows = [...userMap.values()].sort(
      (a, b) => b.activeTaskCount - a.activeTaskCount,
    );
  }

  return (
    <div data-ui="profile" className="flex min-w-0 flex-col gap-6">
      <header className="flex items-center gap-2.5">
        <h1 className="text-xl font-semibold tracking-[-0.3px]">Profil</h1>
        <span className="mt-1.5 truncate text-xs text-fg-2">{user.name ?? user.email}</span>
      </header>

      <section className="flex flex-col gap-4">
        <DashboardTiles summary={summary} />

        {statusBreakdown.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="eyebrow">Twoje zadania w statusach</span>
            <StatusBreakdown items={statusBreakdown} />
          </div>
        )}

        {/* F12-K98: account activity feed — przywrócone na user feedback
            "uciekł widok tego konta ze szczegółami aktywności". */}
        <div id="aktywnosc" className="flex scroll-mt-16 flex-col gap-2 pt-2">
          <div className="flex items-baseline justify-between gap-3">
            <span className="eyebrow">Twoja aktywność</span>
            {myActivity.length > 0 && (
              <span className="font-mono text-2xs text-fg-3">Ostatnie {myActivity.length}</span>
            )}
          </div>
          <ActivityFeed entries={myActivity} />
        </div>

        {isManager && (
          <div className="flex flex-col gap-2 pt-2">
            <div className="flex items-baseline justify-between gap-3">
              <span className="eyebrow">Zespół</span>
              <span className="font-mono text-2xs text-fg-3">
                {teamRows.length} {teamRows.length === 1 ? "osoba" : "osób"}
              </span>
            </div>
            <TeamTasksTable rows={teamRows} />
          </div>
        )}
      </section>

      {/* Ustawienia konta — pod dashboardem, tak jak dotąd. */}
      <section className="flex flex-col gap-4 border-t border-border pt-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">Ustawienia konta</h2>
          <p className="text-xs text-fg-2">
            Te informacje widzą inni członkowie w Twoich przestrzeniach roboczych.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <ProfileForm
            initialName={user.name ?? ""}
            initialTimezone={user.timezone}
            initialAvatarUrl={user.avatarUrl}
            email={user.email}
          />

          <div className="flex flex-col gap-4">
            <div id="2fa" className="scroll-mt-16">
              <TwoFactorSection enabled={!!user.totpEnabledAt} />
            </div>
            <ChangePasswordSection />
          </div>
        </div>

        {user.isSuperAdmin && (
          <div className="rounded-lg border border-border bg-canvas p-4">
            <span className="eyebrow">Super admin</span>
            <p className="mt-1 text-xs text-fg-2">
              Masz dostęp do panelu administracyjnego — globalne tagi, flagi modułów i dziennik
              audytu systemu.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
