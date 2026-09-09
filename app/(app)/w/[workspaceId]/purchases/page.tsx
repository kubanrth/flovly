import { db } from "@/lib/db";
import { requireWorkspaceMembership } from "@/lib/workspace-guard";
import { can } from "@/lib/permissions";
import { PurchasesTool } from "@/components/purchases/purchases-tool";

// F13 „Zapotrzebowanie" — tablica zgloszen zakupowych przestrzeni.
// Widocznosc wierszy (jak w Subskrypcjach, projekty sa wspolne):
//   - workspace ADMIN → wszystko,
//   - czlonek → zgloszenia bez projektu + z projektow, do ktorych ma dostep.
// Dodawanie/edycja/kasowanie = `purchase.manage`; projekty i dostepy = ADMIN.
export default async function PurchasesPage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params;
  const ctx = await requireWorkspaceMembership(workspaceId);
  const isAdmin = ctx.role === "ADMIN";

  const [rows, projects, memberships] = await Promise.all([
    db.purchaseRequest.findMany({
      where: {
        workspaceId,
        deletedAt: null,
        ...(isAdmin ? {} : { OR: [{ projectId: null }, { project: { members: { some: { userId: ctx.userId } } } }] }),
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, link: true, costCents: true, createdAt: true, projectId: true,
        requester: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
    }),
    db.workspaceProject.findMany({
      where: {
        workspaceId,
        deletedAt: null,
        // Nie-admin nie moze przypiac zgloszenia do projektu, ktorego nie widzi.
        ...(isAdmin ? {} : { members: { some: { userId: ctx.userId } } }),
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true, members: { select: { userId: true } } },
    }),
    db.workspaceMembership.findMany({
      where: { workspaceId, user: { deletedAt: null } },
      orderBy: { joinedAt: "asc" },
      select: { user: { select: { id: true, name: true, email: true } } },
    }),
  ]);

  return (
    <PurchasesTool
      workspaceId={workspaceId}
      currentUserId={ctx.userId}
      canManage={can(ctx.role, "purchase.manage")}
      isAdmin={isAdmin}
      items={rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }))}
      projects={projects.map((p) => ({ id: p.id, name: p.name, memberIds: p.members.map((m) => m.userId) }))}
      members={memberships.map((m) => ({ id: m.user.id, name: m.user.name?.trim() || m.user.email.split("@")[0]! }))}
    />
  );
}
