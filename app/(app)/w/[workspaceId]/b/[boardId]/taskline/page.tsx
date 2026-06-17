import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireWorkspaceMembership } from "@/lib/workspace-guard";
import { can } from "@/lib/permissions";
import { Prisma } from "@/lib/generated/prisma/client";
import { BoardShell } from "@/components/view/board-shell";
import { ViewTransition } from "@/components/view/view-transition";
import { BoardHeaderServer } from "@/components/view/board-header-server";
import { BoardLinksServer } from "@/components/board/board-links-server";
import { parseEnabledViews } from "@/lib/board-views";
import {
  TaskLineWorkspace,
  type TaskLineTask,
} from "@/components/canvas/taskline-workspace";
import type {
  TaskLineFlowItem,
  TaskLineRowMeta,
} from "@/components/canvas/taskline-flow";

// F12-K73 v3: Task Line jako multi-line linear flow.
async function ensureTaskLineCanvas(
  boardId: string,
  workspaceId: string,
  creatorId: string,
  boardName: string,
) {
  const existing = await db.processCanvas.findFirst({
    where: { boardId, kind: "taskline", deletedAt: null },
    include: {
      nodes: {
        where: { shape: "TASK_REF" },
        orderBy: { x: "asc" },
      },
      taskLineRows: { orderBy: { order: "asc" } },
    },
  });
  if (existing) return existing;

  const created = await db.processCanvas.create({
    data: {
      workspaceId,
      boardId,
      kind: "taskline",
      name: `Task Line — ${boardName}`,
      creatorId,
    },
    include: {
      nodes: {
        where: { shape: "TASK_REF" },
        orderBy: { x: "asc" },
      },
      taskLineRows: { orderBy: { order: "asc" } },
    },
  });
  return created;
}

// Lazy backfill: jeśli canvas nie ma żadnej linii, tworzymy domyślną
// "Linia 1" + przypisujemy wszystkie istniejące node'y do niej (update
// dataJson.lineId). Działa na pierwszy visit po deploy'u v3.
async function ensureDefaultLine(
  canvasId: string,
  existingNodes: { id: string; dataJson: Prisma.JsonValue | null }[],
  existingRows: { id: string }[],
) {
  if (existingRows.length > 0) return existingRows;

  const row = await db.taskLineRow.create({
    data: { canvasId, name: "Linia 1", order: 0 },
  });

  // Backfill — wszystkim node'om wpisujemy lineId = row.id.
  if (existingNodes.length > 0) {
    await db.$transaction(
      existingNodes.map((n) => {
        const meta =
          n.dataJson && typeof n.dataJson === "object" && !Array.isArray(n.dataJson)
            ? { ...(n.dataJson as Record<string, unknown>) }
            : {};
        meta.lineId = row.id;
        return db.processNode.update({
          where: { id: n.id },
          data: { dataJson: meta as Prisma.InputJsonValue },
        });
      }),
    );
  }

  return [{ id: row.id }];
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
  const enabledViews = parseEnabledViews(board.workspace.enabledViews);

  const [canvas, tasks, memberships] = await Promise.all([
    ensureTaskLineCanvas(board.id, workspaceId, ctx.userId, board.name),
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
    db.workspaceMembership.findMany({
      where: { workspaceId },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
      orderBy: { joinedAt: "asc" },
    }),
  ]);

  // Lazy migrate — gdy canvas nie ma żadnej linii (świeży po v2→v3 deploy).
  await ensureDefaultLine(canvas.id, canvas.nodes, canvas.taskLineRows);

  // Re-fetch po ensureDefaultLine — żeby dostać świeże dataJson + rows.
  const rowsAfter = await db.taskLineRow.findMany({
    where: { canvasId: canvas.id },
    orderBy: { order: "asc" },
  });
  const nodesAfter = await db.processNode.findMany({
    where: { canvasId: canvas.id, shape: "TASK_REF" },
    orderBy: { x: "asc" },
  });

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

  // Build initial items dla TaskLineFlow z TASK_REF nodes.
  const tasksById = new Map(taskLineTasks.map((t) => [t.id, t]));
  const firstRowId = rowsAfter[0]?.id ?? null;
  const initialItems: TaskLineFlowItem[] = nodesAfter
    .map((n) => {
      const meta =
        n.dataJson && typeof n.dataJson === "object" && !Array.isArray(n.dataJson)
          ? (n.dataJson as Record<string, unknown>)
          : {};
      const taskId = typeof meta.taskId === "string" ? meta.taskId : null;
      if (!taskId) return null;
      const fresh = tasksById.get(taskId);
      const lineId =
        typeof meta.lineId === "string" && rowsAfter.some((r) => r.id === meta.lineId)
          ? meta.lineId
          : firstRowId;
      if (!lineId) return null;
      return {
        id: n.id,
        taskId,
        taskTitle:
          fresh?.title ??
          (typeof meta.taskTitle === "string" ? meta.taskTitle : "(usunięte zadanie)"),
        statusName:
          fresh?.statusName ??
          (typeof meta.statusName === "string" ? meta.statusName : null),
        statusColor:
          fresh?.statusColor ??
          (typeof meta.statusColor === "string" ? meta.statusColor : null),
        displayId: fresh?.displayId ?? null,
        flowMark:
          meta.flowMark === "start" || meta.flowMark === "end"
            ? (meta.flowMark as "start" | "end")
            : null,
        x: n.x,
        lineId,
      } satisfies TaskLineFlowItem;
    })
    .filter((x): x is TaskLineFlowItem => x !== null);

  const initialRows: TaskLineRowMeta[] = rowsAfter.map((r) => ({
    id: r.id,
    name: r.name,
    order: r.order,
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
          canvasId={canvas.id}
          canEdit={canEdit}
          tasks={taskLineTasks}
          members={members}
          initialItems={initialItems}
          initialRows={initialRows}
        />
      </ViewTransition>
    </BoardShell>
  );
}
