import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { VacationWorkspace } from "@/components/vacations/vacations-workspace";

export default async function VacationsPage() {
  const session = await auth();
  if (!session?.user) redirect("/secure-access-portal");
  const userId = session.user.id;

  // Who is "your workspace colleagues"? Any user who shares at least one
  // active workspace membership with you. Self included so the list also
  // shows your own approved/pending leave next to teammates.
  const myWorkspaces = await db.workspaceMembership.findMany({
    where: { userId, workspace: { deletedAt: null } },
    select: { workspaceId: true },
  });
  const workspaceIds = myWorkspaces.map((m) => m.workspaceId);

  // Time window for the calendar view: today → +90d. Past leave is rendered
  // in "Moje wnioski"; the team calendar focuses on what's upcoming.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const horizon = new Date(today);
  horizon.setDate(horizon.getDate() + 90);

  const [me, teammates, myRequests, pendingForAdmin] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, isSuperAdmin: true },
    }),
    // Pull both the teammate profile + their upcoming non-rejected leave in
    // one query. Group by user on the client side.
    db.workspaceMembership.findMany({
      where: {
        workspaceId: { in: workspaceIds },
        user: { isBanned: false, deletedAt: null },
      },
      distinct: ["userId"],
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            vacationRequests: {
              where: {
                status: { in: ["pending", "approved"] },
                endDate: { gte: today },
                startDate: { lte: horizon },
              },
              orderBy: { startDate: "asc" },
            },
          },
        },
      },
      orderBy: { joinedAt: "asc" },
    }),
    db.vacationRequest.findMany({
      where: { requesterId: userId },
      orderBy: { startDate: "desc" },
      take: 30,
      include: {
        decidedBy: { select: { id: true, name: true, email: true } },
      },
    }),
    // Only fetched for super admins — empty array otherwise so the section
    // stays hidden.
    (
      await db.user.findUnique({ where: { id: userId }, select: { isSuperAdmin: true } })
    )?.isSuperAdmin
      ? db.vacationRequest.findMany({
          where: { status: "pending" },
          orderBy: { createdAt: "asc" },
          include: {
            requester: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
          },
        })
      : Promise.resolve([]),
  ]);

  return (
    <VacationWorkspace
      currentUserId={userId}
      currentUserName={me?.name ?? me?.email ?? ""}
      isSuperAdmin={!!me?.isSuperAdmin}
      colleagues={teammates
        // Dedup by userId — distinct on findMany covers same-workspace dupes
        // but the user may appear in multiple workspaces in this list.
        .reduce<{
          id: string;
          name: string | null;
          email: string;
          avatarUrl: string | null;
          upcoming: { id: string; startDate: string; endDate: string; status: string }[];
        }[]>((acc, m) => {
          if (acc.some((x) => x.id === m.user.id)) return acc;
          acc.push({
            id: m.user.id,
            name: m.user.name,
            email: m.user.email,
            avatarUrl: m.user.avatarUrl,
            upcoming: m.user.vacationRequests.map((v) => ({
              id: v.id,
              startDate: v.startDate.toISOString(),
              endDate: v.endDate.toISOString(),
              status: v.status,
            })),
          });
          return acc;
        }, [])}
      myRequests={myRequests.map((r) => ({
        id: r.id,
        startDate: r.startDate.toISOString(),
        endDate: r.endDate.toISOString(),
        reason: r.reason,
        status: r.status,
        decidedByName: r.decidedBy
          ? r.decidedBy.name ?? r.decidedBy.email
          : null,
        decidedAt: r.decidedAt ? r.decidedAt.toISOString() : null,
      }))}
      pendingForAdmin={pendingForAdmin.map((r) => ({
        id: r.id,
        startDate: r.startDate.toISOString(),
        endDate: r.endDate.toISOString(),
        reason: r.reason,
        requester: {
          id: r.requester.id,
          name: r.requester.name,
          email: r.requester.email,
          avatarUrl: r.requester.avatarUrl,
        },
      }))}
    />
  );
}
