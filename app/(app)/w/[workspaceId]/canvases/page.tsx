import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireWorkspaceMembership } from "@/lib/workspace-guard";
import { can } from "@/lib/permissions";
import { accessMapFor, allowedResourceIds } from "@/lib/access-queries";
import { needsAccessFilter } from "@/lib/resource-access";
import { CanvasesList, type CanvasRow } from "@/app/(app)/w/[workspaceId]/canvases/canvases-list";

export default async function CanvasesPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const ctx = await requireWorkspaceMembership(workspaceId);

  const workspace = await db.workspace.findFirst({
    where: { id: workspaceId, deletedAt: null },
    select: { id: true },
  });
  if (!workspace) notFound();

  // F14: whiteboard jest prywatny, dopóki ktoś go nie udostępni — widzi go
  // ADMIN, autor i osoby z listy dostępu. Ta sama reguła gatuje `/c/[canvasId]`.
  const viewer = { role: ctx.role, userId: ctx.userId };
  const allowed = needsAccessFilter(viewer) ? await allowedResourceIds(workspaceId, "CANVAS", ctx.userId) : null;

  const [canvases, memberships] = await Promise.all([
    db.processCanvas.findMany({
      where: {
        workspaceId,
        deletedAt: null,
        ...(allowed ? { OR: [{ creatorId: ctx.userId }, { id: { in: allowed } }] } : {}),
      },
      orderBy: { updatedAt: "desc" },
      include: {
        creator: { select: { id: true, name: true, email: true } },
        _count: { select: { nodes: true, edges: true } },
      },
    }),
    db.workspaceMembership.findMany({
      where: { workspaceId },
      orderBy: { joinedAt: "asc" },
      select: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    }),
  ]);

  const accessMap = await accessMapFor("CANVAS", canvases.map((c) => c.id));

  const rows: CanvasRow[] = canvases.map((c) => ({
    id: c.id,
    name: c.name,
    authorName: c.creator.name ?? c.creator.email.split("@")[0]!,
    nodeCount: c._count.nodes,
    edgeCount: c._count.edges,
  }));

  return (
    <CanvasesList
      workspaceId={workspaceId}
      canvases={rows}
      canCreate={can(ctx.role, "canvas.create")}
      canEdit={can(ctx.role, "canvas.edit")}
      canDelete={can(ctx.role, "canvas.delete")}
      accessMap={accessMap}
      members={memberships.map((m) => ({
        id: m.user.id,
        name: m.user.name ?? m.user.email.split("@")[0]!,
        avatarUrl: m.user.avatarUrl,
      }))}
    />
  );
}
