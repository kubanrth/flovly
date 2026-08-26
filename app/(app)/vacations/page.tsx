import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { VacationWorkspace, type LeaveRequest } from "@/components/vacations/vacations-workspace";
import { ANNUAL_LEAVE_DAYS, usedDays } from "@/components/vacations/leave";

export default async function VacationsPage() {
  const session = await auth();
  if (!session?.user) redirect("/secure-access-portal");
  const userId = session.user.id;

  const me = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, avatarUrl: true, isSuperAdmin: true },
  });
  const isSuperAdmin = !!me?.isSuperAdmin;

  // "Team" = anyone sharing at least one live workspace with you (self included).
  const memberships = await db.workspaceMembership.findMany({
    where: { userId, workspace: { deletedAt: null } },
    select: { workspaceId: true },
  });
  const workspaceIds = memberships.map((m) => m.workspaceId);

  const members = await db.workspaceMembership.findMany({
    where: {
      workspaceId: { in: workspaceIds },
      user: { isBanned: false, deletedAt: null },
    },
    distinct: ["userId"],
    select: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    orderBy: { joinedAt: "asc" },
  });
  const memberIds = members.map((m) => m.user.id);

  const requester = { select: { id: true, name: true, email: true, avatarUrl: true } };
  const decidedBy = { select: { id: true, name: true, email: true } };

  const [activeRows, historyRows] = await Promise.all([
    // Live leave — feeds the schedule, "Nieobecni dziś", conflicts and the
    // pending queue. Super-admins also see pending requests from outside
    // their own workspaces, exactly like before the redesign.
    db.vacationRequest.findMany({
      where: {
        status: { in: ["pending", "approved"] },
        OR: [
          { requesterId: { in: memberIds } },
          // Own requests always show, even for a user without memberships.
          { requesterId: userId },
          // Super-admins decide for everyone, also outside their workspaces.
          ...(isSuperAdmin ? [{ status: "pending" }] : []),
        ],
      },
      orderBy: { startDate: "asc" },
      include: { requester, decidedBy },
    }),
    db.vacationRequest.findMany({
      where: {
        status: { in: ["approved", "rejected", "cancelled"] },
        OR: [{ requesterId: { in: memberIds } }, { requesterId: userId }],
      },
      orderBy: [{ decidedAt: "desc" }, { startDate: "desc" }],
      take: 20,
      include: { requester, decidedBy },
    }),
  ]);

  const toLeave = (r: (typeof activeRows)[number]): LeaveRequest => ({
    id: r.id,
    requesterId: r.requesterId,
    requesterName: r.requester.name ?? r.requester.email,
    requesterAvatarUrl: r.requester.avatarUrl,
    startDate: r.startDate.toISOString(),
    endDate: r.endDate.toISOString(),
    reason: r.reason,
    status: r.status,
    decidedByName: r.decidedBy ? (r.decidedBy.name ?? r.decidedBy.email) : null,
    decidedAt: r.decidedAt ? r.decidedAt.toISOString() : null,
  });

  const active = activeRows.map(toLeave);
  const now = new Date();
  const year = now.getFullYear();
  // Limit tile counts this year's approved leave of the signed-in user only.
  const used = usedDays(
    active.filter(
      (r) => r.requesterId === userId && r.status === "approved" && new Date(r.startDate).getUTCFullYear() === year,
    ),
  );

  const team = members.map((m) => ({
    id: m.user.id,
    name: m.user.name ?? m.user.email,
    avatarUrl: m.user.avatarUrl,
  }));
  // A user with no memberships still belongs on their own schedule row.
  if (me && !team.some((t) => t.id === userId)) {
    team.unshift({ id: me.id, name: me.name ?? me.email, avatarUrl: me.avatarUrl });
  }

  return (
    <VacationWorkspace
      currentUserId={userId}
      isSuperAdmin={isSuperAdmin}
      today={`${year}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`}
      year={year}
      month={now.getMonth()}
      limit={ANNUAL_LEAVE_DAYS}
      used={used}
      team={team}
      active={active}
      pending={active.filter((r) => r.status === "pending" && (isSuperAdmin || r.requesterId === userId))}
      history={historyRows.map(toLeave)}
    />
  );
}
