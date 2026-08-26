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
import { ShareBoardButton } from "@/components/board/share-board-button";
import {
  CalendarBoard,
  type CalendarMilestone,
  type CalendarTask,
} from "@/components/calendar/calendar-board";

// Kalendarz tablicy (B7): miesięczny grid zadań po startAt/stopAt + milestone'y.
export default async function BoardCalendarPage({
  params,
}: {
  params: Promise<{ workspaceId: string; boardId: string }>;
}) {
  const { workspaceId, boardId } = await params;
  const ctx = await requireWorkspaceMembership(workspaceId);

  const memberships = await db.workspaceMembership.findMany({
    where: { workspaceId },
    include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    orderBy: { joinedAt: "asc" },
  });

  const board = await db.board.findFirst({
    where: { id: boardId, workspaceId, deletedAt: null },
    include: {
      workspace: { select: { enabledViews: true } },
      statusColumns: { orderBy: { order: "asc" } },
      milestones: { where: { deletedAt: null }, select: { id: true, title: true, stopAt: true } },
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
          statusColumnId: true,
          statusColumn: { select: { name: true, colorHex: true } },
          assignees: { select: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } } },
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
    statusId: t.statusColumnId,
    statusName: t.statusColumn?.name ?? null,
    statusColor: t.statusColumn?.colorHex ?? null,
    startAt: t.startAt ? t.startAt.toISOString() : null,
    stopAt: t.stopAt ? t.stopAt.toISOString() : null,
    assignees: t.assignees.map((a) => ({
      id: a.user.id,
      name: a.user.name ?? a.user.email,
      avatarUrl: a.user.avatarUrl,
    })),
  }));

  const milestones: CalendarMilestone[] = board.milestones.map((m) => ({
    id: m.id,
    title: m.title,
    stopAt: m.stopAt.toISOString(),
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
          <>
            <ShareBoardButton workspaceId={workspaceId} boardId={board.id} />
            {canCreate && (
              <>
                <ImportTasksDialog workspaceId={workspaceId} boardId={board.id} />
                <CreateTaskButton workspaceId={workspaceId} boardId={board.id} />
              </>
            )}
          </>
        }
      />

      <ViewTransition>
        <CalendarBoard
          workspaceId={workspaceId}
          boardId={board.id}
          canEdit={canEdit}
          canCreate={canCreate}
          tasks={calendarTasks}
          milestones={milestones}
          statusColumns={board.statusColumns.map((c) => ({ id: c.id, name: c.name, colorHex: c.colorHex }))}
          members={memberships.map((m) => ({
            id: m.user.id,
            name: m.user.name ?? m.user.email,
            avatarUrl: m.user.avatarUrl,
          }))}
        />
      </ViewTransition>
    </BoardShell>
  );
}
