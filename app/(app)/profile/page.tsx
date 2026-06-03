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
    <main className="flex-1 px-4 py-6 md:px-14 md:py-14">
      <div className="mx-auto flex max-w-6xl flex-col gap-10">
        {/* Dashboard */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <span className="eyebrow">Dashboard</span>
            <h1 className="font-display text-[1.6rem] font-bold leading-[1.1] tracking-[-0.03em] md:text-[2rem]">
              Cześć,{" "}
              <span className="text-brand-gradient">
                {user.name ?? user.email.split("@")[0]}
              </span>
              .
            </h1>
            <p className="text-[0.92rem] leading-[1.55] text-muted-foreground">
              Twoja praca w pigułce. Statusy są agregowane między wszystkimi
              tablicami w workspace&apos;ach.
            </p>
          </div>

          <DashboardTiles summary={summary} />

          {statusBreakdown.length > 0 && (
            <div className="flex flex-col gap-3">
              <span className="eyebrow">Twoje zadania w statusach</span>
              <StatusBreakdown items={statusBreakdown} />
            </div>
          )}

          {isManager && (
            <div className="flex flex-col gap-3 pt-4">
              <div className="flex items-baseline justify-between gap-3">
                <span className="eyebrow text-primary">Zespół</span>
                <span className="font-mono text-[0.66rem] uppercase tracking-[0.14em] text-muted-foreground">
                  {teamRows.length}{" "}
                  {teamRows.length === 1 ? "osoba" : "osób"}
                </span>
              </div>
              <TeamTasksTable rows={teamRows} />
            </div>
          )}
        </div>

        {/* Settings — kept below the dashboard so it's still discoverable
            without dominating the page anymore. */}
        <div className="flex flex-col gap-8 border-t border-border pt-8">
          <div className="flex flex-col gap-2">
            <span className="eyebrow">Ustawienia konta</span>
            <h2 className="font-display text-[1.4rem] font-bold leading-[1.15] tracking-[-0.02em]">
              Twój profil
            </h2>
            <p className="text-[0.92rem] leading-[1.55] text-muted-foreground">
              Te informacje widzą inni członkowie w twoich przestrzeniach roboczych.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
            <ProfileForm
              initialName={user.name ?? ""}
              initialTimezone={user.timezone}
              initialAvatarUrl={user.avatarUrl}
              email={user.email}
            />

            <div className="flex flex-col gap-8">
              <TwoFactorSection enabled={!!user.totpEnabledAt} />
              <ChangePasswordSection />
            </div>
          </div>

          {user.isSuperAdmin && (
            <div className="border-t border-border pt-6">
              <span className="eyebrow text-primary">Super Admin</span>
              <p className="mt-2 text-[0.88rem] leading-[1.55] text-muted-foreground">
                Masz dostęp do panelu administracyjnego (F7). Zarządzanie
                globalnymi tagami, flagami modułów oraz audit log’iem systemu.
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
