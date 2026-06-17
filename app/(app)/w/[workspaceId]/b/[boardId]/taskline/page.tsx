import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireWorkspaceMembership } from "@/lib/workspace-guard";
import { can } from "@/lib/permissions";
import { BoardShell } from "@/components/view/board-shell";
import { ViewTransition } from "@/components/view/view-transition";
import { BoardHeaderServer } from "@/components/view/board-header-server";
import { BoardLinksServer } from "@/components/board/board-links-server";
import { parseEnabledViews } from "@/lib/board-views";
import {
  TaskLineWorkspace,
  type TaskLineTask,
} from "@/components/canvas/taskline-workspace";

// F12-K73: Task Line — analogiczny do whiteboard ale z dedykowanym
// ProcessCanvas.kind='taskline'. Auto-create na pierwszy visit.
async function ensureTaskLineCanvas(
  boardId: string,
  workspaceId: string,
  creatorId: string,
  boardName: string,
) {
  const existing = await db.processCanvas.findFirst({
    where: { boardId, kind: "taskline", deletedAt: null },
    include: {
      nodes: true,
      edges: true,
      strokes: { orderBy: { createdAt: "asc" } },
    },
  });
  if (existing) return existing;

  const created = await db.processCanvas.create({
    data: {
      workspaceId,
      boardId,
      kind: "taskline",
      // "Task Line — <board>" w canvas list'cie; nie jest exposed w UI.
      name: `Task Line — ${boardName}`,
      creatorId,
    },
    include: {
      nodes: true,
      edges: true,
      strokes: { orderBy: { createdAt: "asc" } },
    },
  });
  return created;
}

export default async function BoardTaskLinePage({
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

  const canEdit = can(ctx.role, "canvas.edit");
  const canCreateTask = can(ctx.role, "task.create");
  const enabledViews = parseEnabledViews(board.workspace.enabledViews);

  const [canvas, tasks, memberships, workspaceTasks] = await Promise.all([
    ensureTaskLineCanvas(board.id, workspaceId, ctx.userId, board.name),
    // Sidebar pool — wszystkie taski tej tablicy z status'em + assignees +
    // displayId żeby renderować "kafelek" w sidebar'ze + utworzyć snapshot
    // przy drop'ie. Limit 500 — większe tablice paginowane w późniejszej iter.
    db.task.findMany({
      where: { boardId, deletedAt: null },
      orderBy: [{ statusColumn: { order: "asc" } }, { rowOrder: "asc" }],
      take: 500,
      select: {
        id: true,
        title: true,
        displayId: true,
        statusColumn: { select: { name: true, colorHex: true } },
        assignees: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
          },
        },
      },
    }),
    // Members do filter pills.
    db.workspaceMembership.findMany({
      where: { workspaceId },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
      orderBy: { joinedAt: "asc" },
    }),
    // Workspace task pool dla rich-text task-link picker'ów wewnątrz CanvasEditor.
    db.task.findMany({
      where: { workspaceId, deletedAt: null },
      orderBy: { updatedAt: "desc" },
      take: 300,
      select: { id: true, title: true },
    }),
  ]);

  const taskLineTasks: TaskLineTask[] = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    displayId: t.displayId,
    statusName: t.statusColumn?.name ?? null,
    statusColor: t.statusColumn?.colorHex ?? null,
    assignees: t.assignees.map((a) => ({
      id: a.user.id,
      name: a.user.name,
      email: a.user.email,
      avatarUrl: a.user.avatarUrl,
    })),
  }));

  const members = memberships.map((m) => ({
    id: m.user.id,
    name: m.user.name,
    email: m.user.email,
    avatarUrl: m.user.avatarUrl,
  }));

  return (
    <BoardShell bgCss={null}>
      <BoardHeaderServer
        workspaceId={workspaceId}
        boardId={board.id}
        board={{ name: board.name, description: board.description }}
        active="taskline"
        enabledViews={enabledViews}
        extra={<BoardLinksServer workspaceId={workspaceId} boardId={board.id} />}
      />

      <ViewTransition>
        <TaskLineWorkspace
          workspaceId={workspaceId}
          boardId={board.id}
          canvasId={canvas.id}
          canEdit={canEdit}
          canCreateTask={canCreateTask}
          tasks={taskLineTasks}
          members={members}
          workspaceTasks={workspaceTasks}
          initialNodes={canvas.nodes.map((n) => {
            const meta =
              n.dataJson && typeof n.dataJson === "object" && !Array.isArray(n.dataJson)
                ? (n.dataJson as Record<string, unknown>)
                : {};
            return {
              id: n.id,
              shape: n.shape === "ICON" ? "RECTANGLE" : n.shape,
              label: n.label,
              x: n.x,
              y: n.y,
              width: n.width,
              height: n.height,
              colorHex: n.colorHex,
              linkedTasks: [],
              locked: meta.locked === true ? true : undefined,
              taskId: typeof meta.taskId === "string" ? meta.taskId : null,
              taskTitle: typeof meta.taskTitle === "string" ? meta.taskTitle : null,
              statusName: typeof meta.statusName === "string" ? meta.statusName : null,
              statusColor: typeof meta.statusColor === "string" ? meta.statusColor : null,
              flowMark:
                meta.flowMark === "start" || meta.flowMark === "end"
                  ? (meta.flowMark as "start" | "end")
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
        />
      </ViewTransition>
    </BoardShell>
  );
}
