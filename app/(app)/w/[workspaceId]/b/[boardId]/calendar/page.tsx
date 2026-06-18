import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireWorkspaceMembership } from "@/lib/workspace-guard";
import { can } from "@/lib/permissions";
import { BoardShell } from "@/components/view/board-shell";
import { ViewTransition } from "@/components/view/view-transition";
import { BoardHeaderServer } from "@/components/view/board-header-server";
import { BoardLinksServer } from "@/components/board/board-links-server";
import { parseEnabledViews } from "@/lib/board-views";
import { CreateTaskButton } from "@/components/task/create-task-button";
import { ImportTasksDialog } from "@/components/task/import-tasks-dialog";
import {
  CalendarBoard,
  type CalendarTask,
} from "@/components/calendar/calendar-board";

// F12-K78: Calendar view — miesieczny grid zadan z deadline'em.
export default async function BoardCalendarPage({
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
        where: {
          deletedAt: null,
          // Tylko z datą — kalendarz bez startAt/stopAt nie ma sensu.
          OR: [{ startAt: { not: null } }, { stopAt: { not: null } }],
        },
        select: {
          id: true,
          displayId: true,
          title: true,
          startAt: true,
          stopAt: true,
          priority: true,
          statusColumn: { select: { name: true, colorHex: true } },
        },
      },
    },
  });
  if (!board) notFound();

  const canEdit = can(ctx.role, "task.update");
  const canCreate = can(ctx.role, "task.create");
  const enabledViews = parseEnabledViews(board.workspace.enabledViews);

  const calendarTasks: CalendarTask[] = board.tasks.map((t) => ({
    id: t.id,
    displayId: t.displayId,
    title: t.title,
    statusName: t.statusColumn?.name ?? null,
    statusColor: t.statusColumn?.colorHex ?? null,
    priority: t.priority,
    startAt: t.startAt ? t.startAt.toISOString() : null,
    stopAt: t.stopAt ? t.stopAt.toISOString() : null,
  }));

  return (
    <BoardShell bgCss={null}>
      <BoardHeaderServer
        workspaceId={workspaceId}
        boardId={board.id}
        board={{ name: board.name, description: board.description }}
        active="calendar"
        enabledViews={enabledViews}
        extra={<BoardLinksServer workspaceId={workspaceId} boardId={board.id} />}
        actions={
          canCreate ? (
            <>
              <ImportTasksDialog workspaceId={workspaceId} boardId={board.id} />
              <CreateTaskButton workspaceId={workspaceId} boardId={board.id} />
            </>
          ) : null
        }
      />

      <ViewTransition>
        <CalendarBoard
          workspaceId={workspaceId}
          boardId={board.id}
          canEdit={canEdit}
          tasks={calendarTasks}
        />
      </ViewTransition>
    </BoardShell>
  );
}
