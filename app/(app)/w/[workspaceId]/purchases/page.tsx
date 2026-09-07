import { db } from "@/lib/db";
import { requireWorkspaceMembership } from "@/lib/workspace-guard";
import { can } from "@/lib/permissions";
import { PurchasesTool } from "@/components/purchases/purchases-tool";

// F13 „Zapotrzebowanie" — tablica zgloszen zakupowych przestrzeni. Kazdy
// czlonek widzi wszystko; dodawanie/edycja/kasowanie = `purchase.manage`.
export default async function PurchasesPage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params;
  const ctx = await requireWorkspaceMembership(workspaceId);
  const rows = await db.purchaseRequest.findMany({
    where: { workspaceId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, project: true, link: true, costCents: true, createdAt: true, requester: { select: { id: true, name: true, email: true, avatarUrl: true } } },
  });
  return (
    <PurchasesTool
      workspaceId={workspaceId}
      currentUserId={ctx.userId}
      canManage={can(ctx.role, "purchase.manage")}
      items={rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }))}
    />
  );
}
