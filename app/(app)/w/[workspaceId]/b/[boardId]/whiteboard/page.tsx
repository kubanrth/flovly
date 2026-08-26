import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireWorkspaceMembership } from "@/lib/workspace-guard";
import { can } from "@/lib/permissions";
import { CanvasEditorLazy } from "@/components/canvas/canvas-editor-lazy";
import { CanvasPresenceStack } from "@/components/canvas/canvas-presence";
import { BoardShell } from "@/components/view/board-shell";
import { ViewTransition } from "@/components/view/view-transition";
import { BoardHeaderServer } from "@/components/view/board-header-server";
import { BoardLinksServer } from "@/components/board/board-links-server";
import { parseEnabledViews } from "@/lib/board-views";

// One canvas per board, auto-created on first visit (zero-config whiteboard).
async function ensureBoardCanvas(
  boardId: string,
  workspaceId: string,
  creatorId: string,
  boardName: string,
) {
  // F12-K73: filtruj po kind żeby nie złapać przypadkiem canvasu Task Line
  // (Board ma teraz N canvasów, po jednym per kind).
  const existing = await db.processCanvas.findFirst({
    where: { boardId, kind: "whiteboard", deletedAt: null },
    include: {
      nodes: {
        include: {
          taskLinks: {
            include: { task: { select: { id: true, title: true, deletedAt: true } } },
          },
        },
      },
      edges: true,
      strokes: { orderBy: { createdAt: "asc" } },
    },
  });
  if (existing) return existing;

  const created = await db.processCanvas.create({
    data: {
      workspaceId,
      boardId,
      name: boardName,
      creatorId,
    },
    include: {
      nodes: {
        include: {
          taskLinks: {
            include: { task: { select: { id: true, title: true, deletedAt: true } } },
          },
        },
      },
      edges: true,
      strokes: { orderBy: { createdAt: "asc" } },
    },
  });
  return created;
}

export default async function BoardWhiteboardPage({
  params,
}: {
  params: Promise<{ workspaceId: string; boardId: string }>;
}) {
  const { workspaceId, boardId } = await params;
  const ctx = await requireWorkspaceMembership(workspaceId);

  const board = await db.board.findFirst({
    where: { id: boardId, workspaceId, deletedAt: null },
    include: { workspace: { select: { enabledViews: true } } },
  });
  if (!board) notFound();

  const canvas = await ensureBoardCanvas(
    board.id,
    workspaceId,
    ctx.userId,
    board.name,
  );

  const canEdit = can(ctx.role, "canvas.edit");
  const canCreateTask = can(ctx.role, "task.create");
  const enabledViews = parseEnabledViews(board.workspace.enabledViews);

  const [boardTasks, me] = await Promise.all([
    db.task.findMany({
      where: { boardId, deletedAt: null },
      orderBy: { updatedAt: "desc" },
      take: 300,
      select: {
        id: true,
        title: true,
        displayId: true,
        statusColumn: { select: { name: true, colorHex: true } },
      },
    }),
    db.user.findUnique({
      where: { id: ctx.userId },
      select: { name: true, email: true, avatarUrl: true },
    }),
  ]);

  // Meta do wstawiania kart zadania (#ID) na kanwę + rehydratacja tytułu i
  // statusu węzłów TASK_REF, których snapshot mógł się zestarzeć.
  const taskMetaById = new Map(
    boardTasks.map((t) => [
      t.id,
      {
        id: t.id,
        title: t.title,
        displayId: t.displayId,
        statusName: t.statusColumn?.name ?? null,
        statusColor: t.statusColumn?.colorHex ?? null,
      },
    ]),
  );

  const linksByNode = new Map<string, { taskId: string; title: string }[]>();
  for (const n of canvas.nodes) {
    const alive = n.taskLinks
      .filter((l) => l.task && !l.task.deletedAt)
      .map((l) => ({ taskId: l.task.id, title: l.task.title }));
    if (alive.length > 0) linksByNode.set(n.id, alive);
  }

  return (
    <BoardShell bgCss={null}>
      <BoardHeaderServer
        workspaceId={workspaceId}
        boardId={board.id}
        board={{ name: board.name, description: board.description }}
        active="whiteboard"
        enabledViews={enabledViews}
        actions={
          <CanvasPresenceStack
            canvasId={canvas.id}
            me={{ name: me?.name ?? me?.email ?? "Ja", avatarUrl: me?.avatarUrl }}
          />
        }
        extra={<BoardLinksServer workspaceId={workspaceId} boardId={board.id} />}
      />

      <ViewTransition>
      {/* B9: kanwa idzie od krawędzi do krawędzi — BoardShell dokłada
          24/16px paddingu widoku, więc go tu odejmujemy. */}
      <div className="-mx-6 -my-4 h-[calc(100dvh-13rem)] min-h-[420px] overflow-hidden border-t border-border max-md:-mx-4">
        <CanvasEditorLazy
          workspaceId={workspaceId}
          canvasId={canvas.id}
          initialNodes={canvas.nodes.map((n) => {
            // dataJson stores reactions/locked and other per-node extras; tolerate any shape.
            const meta =
              n.dataJson && typeof n.dataJson === "object"
                ? (n.dataJson as {
                    reactions?: unknown;
                    locked?: unknown;
                    imagePath?: unknown;
                    textColorHex?: unknown;
                    taskId?: unknown;
                    taskTitle?: unknown;
                    statusName?: unknown;
                    statusColor?: unknown;
                    flowMark?: unknown;
                  })
                : {};
            const taskId = typeof meta.taskId === "string" ? meta.taskId : null;
            const fresh = taskId ? taskMetaById.get(taskId) : undefined;
            const reactions =
              meta.reactions && typeof meta.reactions === "object"
                ? (Object.fromEntries(
                    Object.entries(meta.reactions as Record<string, unknown>)
                      .filter(([, v]) => typeof v === "number" && v > 0)
                      .map(([k, v]) => [k, v as number]),
                  ) as Record<string, number>)
                : undefined;
            return {
              id: n.id,
              shape: n.shape === "ICON" ? "RECTANGLE" : n.shape,
              label: n.label,
              x: n.x,
              y: n.y,
              width: n.width,
              height: n.height,
              colorHex: n.colorHex,
              linkedTasks: linksByNode.get(n.id) ?? [],
              reactions:
                reactions && Object.keys(reactions).length > 0 ? reactions : undefined,
              locked: meta.locked === true ? true : undefined,
              imagePath: typeof meta.imagePath === "string" ? meta.imagePath : null,
              textColorHex:
                typeof meta.textColorHex === "string" ? meta.textColorHex : null,
              taskId,
              taskTitle:
                fresh?.title ??
                (typeof meta.taskTitle === "string" ? meta.taskTitle : null),
              displayId: fresh?.displayId ?? null,
              statusName:
                fresh?.statusName ??
                (typeof meta.statusName === "string" ? meta.statusName : null),
              statusColor:
                fresh?.statusColor ??
                (typeof meta.statusColor === "string" ? meta.statusColor : null),
              flowMark:
                meta.flowMark === "start" || meta.flowMark === "end"
                  ? meta.flowMark
                  : null,
            };
          })}
          initialEdges={canvas.edges.map((e) => ({
            id: e.id,
            fromNodeId: e.fromNodeId,
            toNodeId: e.toNodeId,
            label: e.label,
            style: e.style === "dashed" ? "dashed" : "solid",
          }))}
          initialStrokes={(canvas.strokes ?? []).flatMap((s) => {
            // points JSON is flat number[]; tolerate legacy [{x,y}, ...] too.
            const raw = s.points as unknown;
            const flat: number[] = [];
            if (Array.isArray(raw)) {
              for (const p of raw) {
                if (typeof p === "number" && Number.isFinite(p)) {
                  flat.push(p);
                } else if (
                  p && typeof p === "object" &&
                  typeof (p as { x?: unknown }).x === "number" &&
                  typeof (p as { y?: unknown }).y === "number"
                ) {
                  flat.push((p as { x: number }).x, (p as { y: number }).y);
                }
              }
            }
            if (flat.length < 4) return [];
            return [{ id: s.id, colorHex: s.colorHex, size: s.size, points: flat }];
          })}
          canEdit={canEdit}
          canCreateTask={canCreateTask}
          workspaceTasks={boardTasks.map((t) => ({ id: t.id, title: t.title }))}
          boardTasks={taskMetaById}
          defaultBoardId={board.id}
        />
      </div>
      </ViewTransition>
    </BoardShell>
  );
}
