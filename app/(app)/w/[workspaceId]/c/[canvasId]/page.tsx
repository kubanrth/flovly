import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { requireWorkspaceMembership } from "@/lib/workspace-guard";
import { can } from "@/lib/permissions";
import { CanvasEditorLazy } from "@/components/canvas/canvas-editor-lazy";

export default async function CanvasEditorPage({
  params,
}: {
  params: Promise<{ workspaceId: string; canvasId: string }>;
}) {
  const { workspaceId, canvasId } = await params;
  const ctx = await requireWorkspaceMembership(workspaceId);

  const canvas = await db.processCanvas.findFirst({
    where: { id: canvasId, workspaceId, deletedAt: null },
    include: {
      nodes: {
        include: {
          taskLinks: {
            include: {
              task: {
                select: { id: true, title: true, deletedAt: true },
              },
            },
          },
        },
      },
      edges: true,
    },
  });
  if (!canvas) notFound();

  const canEdit = can(ctx.role, "canvas.edit");
  const canCreateTask = can(ctx.role, "task.create");

  // Picker data for "Podepnij zadanie". Cheap at expected scale (~hundreds of tasks);
  // would need pagination beyond that.
  const [firstBoard, tasks] = await Promise.all([
    db.board.findFirst({
      where: { workspaceId, deletedAt: null },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true },
    }),
    db.task.findMany({
      where: { workspaceId, deletedAt: null },
      orderBy: { updatedAt: "desc" },
      take: 300,
      select: { id: true, title: true },
    }),
  ]);

  // Filter out soft-deleted tasks so chips never point at dead rows.
  const linksByNode = new Map<
    string,
    { taskId: string; title: string }[]
  >();
  for (const n of canvas.nodes) {
    const alive = n.taskLinks
      .filter((l) => l.task && !l.task.deletedAt)
      .map((l) => ({ taskId: l.task.id, title: l.task.title }));
    if (alive.length > 0) linksByNode.set(n.id, alive);
  }

  return (
    <div className="flex h-[calc(100dvh-4rem)] flex-col">
      <header className="flex items-center justify-between border-b border-border bg-background/95 px-8 py-3 backdrop-blur md:px-14">
        <div className="flex items-center gap-3">
          <Link
            href={`/w/${workspaceId}/canvases`}
            className="eyebrow inline-flex items-center gap-1 transition-colors hover:text-foreground"
          >
            <ArrowLeft size={12} /> wróć do listy
          </Link>
          <span className="text-muted-foreground">·</span>
          <h1 className="font-display text-[1.1rem] font-semibold tracking-[-0.01em]">
            {canvas.name}
          </h1>
        </div>
        <span className="font-mono text-[0.64rem] uppercase tracking-[0.14em] text-muted-foreground">
          {canvas.nodes.length} węzłów · {canvas.edges.length} krawędzi
        </span>
      </header>

      <div className="flex-1 min-h-0">
        <CanvasEditorLazy
          workspaceId={workspaceId}
          canvasId={canvas.id}
          initialNodes={canvas.nodes.map((n) => {
            // dataJson holds reactions/locked/imagePath/textColorHex; field can be null or Json object.
            const meta =
              n.dataJson && typeof n.dataJson === "object" && !Array.isArray(n.dataJson)
                ? (n.dataJson as Record<string, unknown>)
                : {};
            const imagePath = typeof meta.imagePath === "string" ? meta.imagePath : null;
            const textColorHex =
              typeof meta.textColorHex === "string" ? meta.textColorHex : null;
            const reactions =
              meta.reactions && typeof meta.reactions === "object"
                ? (meta.reactions as Record<string, number>)
                : undefined;
            const locked = meta.locked === true;
            return {
              id: n.id,
              // Legacy ICON nodes (future feature) downgrade to RECTANGLE on read.
              shape: n.shape === "ICON" ? "RECTANGLE" : n.shape,
              label: n.label,
              x: n.x,
              y: n.y,
              width: n.width,
              height: n.height,
              colorHex: n.colorHex,
              linkedTasks: linksByNode.get(n.id) ?? [],
              reactions,
              locked,
              imagePath,
              textColorHex,
            };
          })}
          initialEdges={canvas.edges.map((e) => ({
            id: e.id,
            fromNodeId: e.fromNodeId,
            toNodeId: e.toNodeId,
            label: e.label,
            style: e.style === "dashed" ? "dashed" : "solid",
          }))}
          canEdit={canEdit}
          canCreateTask={canCreateTask}
          workspaceTasks={tasks}
          defaultBoardId={firstBoard?.id ?? null}
        />
      </div>
    </div>
  );
}
