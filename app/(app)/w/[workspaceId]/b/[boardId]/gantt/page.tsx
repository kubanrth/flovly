import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireWorkspaceMembership } from "@/lib/workspace-guard";
import { can } from "@/lib/permissions";
import { GanttView } from "@/components/roadmap/gantt-view";
import { CreateTaskButton } from "@/components/task/create-task-button";
import { BoardShell } from "@/components/view/board-shell";
import { ViewTransition } from "@/components/view/view-transition";
import { BoardHeaderServer } from "@/components/view/board-header-server";
import { BoardLinksServer } from "@/components/board/board-links-server";
import { parseEnabledViews } from "@/lib/board-views";

export default async function BoardGanttPage({
  params,
}: {
  params: Promise<{ workspaceId: string; boardId: string }>;
}) {
  const { workspaceId, boardId } = await params;
  const ctx = await requireWorkspaceMembership(workspaceId);

  const board = await db.board.findFirst({
    where: { id: boardId, workspaceId, deletedAt: null },
    include: {
      workspace: { select: { enabledViews: true } },
      tasks: {
        where: { deletedAt: null },
        orderBy: [{ startAt: "asc" }, { rowOrder: "asc" }],
        include: {
          statusColumn: { select: { name: true, colorHex: true } },
          assignees: {
            include: {
              user: { select: { id: true, name: true, email: true, avatarUrl: true } },
            },
            take: 1,
          },
        },
      },
    },
  });
  if (!board) notFound();

  const canCreate = can(ctx.role, "task.create");
  const enabledViews = parseEnabledViews(board.workspace.enabledViews);

  const scheduled = board.tasks
    .filter((t) => t.startAt && t.stopAt)
    .map((t) => ({
      id: t.id,
      title: t.title,
      startAt: t.startAt?.toISOString() ?? null,
      stopAt: t.stopAt?.toISOString() ?? null,
      statusColor: t.statusColumn?.colorHex ?? "#94A3B8",
      statusName: t.statusColumn?.name ?? null,
      assignee: t.assignees[0]?.user ?? null,
    }));
  const unscheduled = board.tasks
    .filter((t) => !t.startAt || !t.stopAt)
    .map((t) => ({ id: t.id, title: t.title }));

  return (
    <BoardShell bgCss={null}>
      <BoardHeaderServer
        workspaceId={workspaceId}
        boardId={boardId}
        board={{ name: board.name, description: board.description }}
        active="gantt"
        enabledViews={enabledViews}
        extra={<BoardLinksServer workspaceId={workspaceId} boardId={boardId} />}
        actions={
          canCreate ? (
            <CreateTaskButton workspaceId={workspaceId} boardId={boardId} />
          ) : null
        }
      />

      <ViewTransition>
      <GanttView
        workspaceId={workspaceId}
        scheduled={scheduled}
        unscheduled={unscheduled}
      />
      </ViewTransition>
    </BoardShell>
  );
}
