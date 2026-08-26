import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireWorkspaceMembership } from "@/lib/workspace-guard";
import { can } from "@/lib/permissions";
import { GanttView } from "@/components/roadmap/gantt-view";
import { ganttTaskInclude, toGanttMilestone, toGanttTask } from "@/components/gantt/gantt-reads";
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
      milestones: {
        // Same scoping as the default Roadmapa — custom views own their milestones.
        where: { deletedAt: null, boardViewId: null },
        orderBy: [{ startAt: "asc" }, { orderIndex: "asc" }],
        select: { id: true, title: true, startAt: true, stopAt: true },
      },
      tasks: {
        where: { deletedAt: null },
        orderBy: [{ startAt: "asc" }, { rowOrder: "asc" }],
        include: ganttTaskInclude,
      },
    },
  });
  if (!board) notFound();

  const canCreate = can(ctx.role, "task.create");
  const enabledViews = parseEnabledViews(board.workspace.enabledViews);

  return (
    <BoardShell bgCss={null}>
      <BoardHeaderServer
        workspaceId={workspaceId}
        boardId={boardId}
        board={{ name: board.name, description: board.description }}
        active="gantt"
        enabledViews={enabledViews}
        extra={<BoardLinksServer workspaceId={workspaceId} boardId={boardId} />}
        actions={canCreate ? <CreateTaskButton workspaceId={workspaceId} boardId={boardId} /> : null}
      />

      <ViewTransition>
        <GanttView
          workspaceId={workspaceId}
          boardId={boardId}
          canEdit={can(ctx.role, "task.update")}
          canCreate={canCreate}
          milestones={board.milestones.map(toGanttMilestone)}
          tasks={board.tasks.map(toGanttTask)}
        />
      </ViewTransition>
    </BoardShell>
  );
}
