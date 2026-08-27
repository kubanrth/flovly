import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireWorkspaceMembership } from "@/lib/workspace-guard";
import { can } from "@/lib/permissions";
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

  const canvases = await db.processCanvas.findMany({
    where: { workspaceId, deletedAt: null },
    orderBy: { updatedAt: "desc" },
    include: {
      creator: { select: { id: true, name: true, email: true } },
      _count: { select: { nodes: true, edges: true } },
    },
  });

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
    />
  );
}
