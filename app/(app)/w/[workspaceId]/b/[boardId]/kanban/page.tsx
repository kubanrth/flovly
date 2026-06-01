import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireWorkspaceMembership } from "@/lib/workspace-guard";
import { can } from "@/lib/permissions";
import { KanbanBoard } from "@/components/kanban/kanban-board";
import { CreateTaskButton } from "@/components/task/create-task-button";
import { BackgroundCustomizer } from "@/components/view/background-customizer";
import { BoardShell } from "@/components/view/board-shell";
import { ViewTransition } from "@/components/view/view-transition";
import { BoardHeaderServer } from "@/components/view/board-header-server";
import { docHasText } from "@/lib/prosemirror-text";
import { BoardLinksServer } from "@/components/board/board-links-server";
import { parseEnabledViews } from "@/lib/board-views";
import { CollapsibleColumnManager } from "@/components/table/collapsible-column-manager";
import { backgroundToCss, type BackgroundConfig } from "@/lib/schemas/background";

export default async function BoardKanbanPage({
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
      statusColumns: { orderBy: { order: "asc" } },
      views: { where: { type: "KANBAN" } },
      tasks: {
        where: { deletedAt: null },
        orderBy: [{ statusColumn: { order: "asc" } }, { rowOrder: "asc" }],
        include: {
          assignees: {
            include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
          },
          tags: { include: { tag: true } },
          _count: { select: { comments: { where: { deletedAt: null } } } },
        },
      },
    },
  });
  if (!board) notFound();

  const memberships = await db.workspaceMembership.findMany({
    where: { workspaceId },
    include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    orderBy: { joinedAt: "asc" },
  });

  const canCreate = can(ctx.role, "task.create");
  const canManageBoard = can(ctx.role, "board.update");
  const canCustomize = can(ctx.role, "background.customize");
  const kanbanView = board.views[0];
  const background = (kanbanView?.background ?? null) as BackgroundConfig | null;
  const bgCss = backgroundToCss(background);
  const enabledViews = parseEnabledViews(board.workspace.enabledViews);

  return (
    <BoardShell bgCss={bgCss}>
      <BoardHeaderServer
        workspaceId={workspaceId}
        boardId={board.id}
        board={{ name: board.name, description: board.description }}
        active="kanban"
        enabledViews={enabledViews}
        extra={<BoardLinksServer workspaceId={workspaceId} boardId={board.id} />}
        actions={
          <>
            {canCustomize && (
              <BackgroundCustomizer
                workspaceId={workspaceId}
                boardId={board.id}
                viewType="KANBAN"
                initial={background}
              />
            )}
            {canCreate && (
              <CreateTaskButton workspaceId={workspaceId} boardId={board.id} />
            )}
          </>
        }
      />

      <ViewTransition>
      {canManageBoard && (
        <CollapsibleColumnManager
          workspaceId={workspaceId}
          boardId={board.id}
          columns={board.statusColumns.map((c) => ({
            id: c.id,
            name: c.name,
            colorHex: c.colorHex,
          }))}
        />
      )}

      <KanbanBoard
        workspaceId={workspaceId}
        boardId={board.id}
        canManageBoard={canManageBoard}
        statusColumns={board.statusColumns.map((c) => ({
          id: c.id,
          name: c.name,
          colorHex: c.colorHex,
        }))}
        initialTasks={board.tasks.map((t) => ({
          id: t.id,
          title: t.title,
          statusColumnId: t.statusColumnId,
          rowOrder: t.rowOrder,
          startAt: t.startAt ? t.startAt.toISOString() : null,
          stopAt: t.stopAt ? t.stopAt.toISOString() : null,
          assignees: t.assignees.map((a) => ({
            id: a.userId,
            name: a.user.name,
            email: a.user.email,
            avatarUrl: a.user.avatarUrl,
          })),
          tags: t.tags.map((tt) => ({
            id: tt.tag.id,
            name: tt.tag.name,
            colorHex: tt.tag.colorHex,
          })),
          hasDescription: docHasText(t.descriptionJson),
          commentCount: t._count.comments,
        }))}
        members={memberships.map((m) => m.user)}
      />
      </ViewTransition>
    </BoardShell>
  );
}
