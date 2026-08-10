import { db } from "@/lib/db";
import { requireWorkspaceMembership } from "@/lib/workspace-guard";
import { SubscriptionsTable } from "@/components/subscriptions/subscriptions-table";

// F12-K140/141: moduł zarządzania subskrypcjami z projektami i dostępami.
// Widoczność wierszy:
//   - workspace ADMIN → wszystko
//   - członek → subskrypcje bez projektu + z projektów w których jest
//     członkiem (SubscriptionProjectMember)
export default async function SubscriptionsPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const ctx = await requireWorkspaceMembership(workspaceId);
  const isAdmin = ctx.role === "ADMIN";

  const [rows, projects, memberships] = await Promise.all([
    db.subscription.findMany({
      where: {
        workspaceId,
        deletedAt: null,
        ...(isAdmin
          ? {}
          : {
              OR: [
                { projectId: null },
                { project: { members: { some: { userId: ctx.userId } } } },
              ],
            }),
      },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        url: true,
        amountCents: true,
        cycle: true,
        notes: true,
        projectId: true,
      },
    }),
    db.subscriptionProject.findMany({
      where: {
        workspaceId,
        deletedAt: null,
        // Nie-admin widzi w select'cie tylko projekty do których należy —
        // nie może przypiąć subskrypcji do projektu którego nie widzi.
        ...(isAdmin ? {} : { members: { some: { userId: ctx.userId } } }),
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        members: { select: { userId: true } },
      },
    }),
    db.workspaceMembership.findMany({
      where: { workspaceId },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { joinedAt: "asc" },
    }),
  ]);

  return (
    <SubscriptionsTable
      workspaceId={workspaceId}
      isAdmin={isAdmin}
      rows={rows}
      projects={projects.map((p) => ({
        id: p.id,
        name: p.name,
        memberIds: p.members.map((m) => m.userId),
      }))}
      members={memberships.map((m) => ({
        id: m.user.id,
        name: m.user.name ?? m.user.email,
      }))}
    />
  );
}
