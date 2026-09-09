import { db } from "@/lib/db";
import { requireWorkspaceMembership } from "@/lib/workspace-guard";
import { can } from "@/lib/permissions";
import { accessMapFor, hiddenRestrictedIds } from "@/lib/access-queries";
import { SubscriptionsTable } from "@/components/subscriptions/subscriptions-table";

// F12-K140/141: moduł zarządzania subskrypcjami z projektami i dostępami.
// Widoczność wierszy:
//   - workspace ADMIN → wszystko
//   - członek → subskrypcje bez projektu + z projektów w których jest
//     członkiem projektu (projekty są wspólne z Zapotrzebowaniem)
// F14: na to nakłada się lista dostępu per subskrypcja — pusta znaczy „jak
// dotąd", a niepusta zawęża widoczność wiersza (czyli i kwoty) do wskazanych
// osób i administratorów.
export default async function SubscriptionsPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const ctx = await requireWorkspaceMembership(workspaceId);
  const isAdmin = ctx.role === "ADMIN";
  const hidden = isAdmin ? [] : await hiddenRestrictedIds(workspaceId, "SUBSCRIPTION", ctx.userId);

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
              ...(hidden.length > 0 ? { id: { notIn: hidden } } : {}),
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
    db.workspaceProject.findMany({
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

  const accessMap = await accessMapFor("SUBSCRIPTION", rows.map((r) => r.id));

  return (
    <SubscriptionsTable
      workspaceId={workspaceId}
      isAdmin={isAdmin}
      canManage={can(ctx.role, "subscription.manage")}
      rows={rows}
      projects={projects.map((p) => ({
        id: p.id,
        name: p.name,
        memberIds: p.members.map((m) => m.userId),
      }))}
      accessMap={accessMap}
      members={memberships.map((m) => ({
        id: m.user.id,
        name: m.user.name ?? m.user.email,
      }))}
    />
  );
}
