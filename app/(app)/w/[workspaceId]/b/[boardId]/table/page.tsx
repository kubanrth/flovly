import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireWorkspaceMembership } from "@/lib/workspace-guard";
import { can } from "@/lib/permissions";
import { BoardTable, type CustomTableColumn } from "@/components/table/board-table";
import { ListStateProvider } from "@/components/table/list-state";
import { parseListConfig } from "@/components/table/list-config";
import { ListToolbar } from "@/components/table/list-toolbar";
import { CreateTaskButton } from "@/components/task/create-task-button";
import { ImportTasksDialog } from "@/components/task/import-tasks-dialog";
import { ShareBoardButton } from "@/components/board/share-board-button";
import { BoardShell } from "@/components/view/board-shell";
import { ViewTransition } from "@/components/view/view-transition";
import { BoardHeaderServer } from "@/components/view/board-header-server";
import { docHasText } from "@/lib/prosemirror-text";
import { BoardLinksServer } from "@/components/board/board-links-server";
import { parseEnabledViews } from "@/lib/board-views";
import { backgroundToCss, type BackgroundConfig } from "@/lib/schemas/background";
import { taskInclude, toTableTask } from "@/components/table/table-reads";

export default async function BoardTablePage({
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

  // Full tag list for the in-cell picker; mirrors the workspace + global OR in task-fetch.ts.
  const allTags = await db.tag.findMany({
    where: { OR: [{ workspaceId }, { workspaceId: null }] },
    orderBy: [{ workspaceId: { sort: "desc", nulls: "last" } }, { name: "asc" }],
    select: { id: true, name: true, colorHex: true },
  });

  const board = await db.board.findFirst({
    where: { id: boardId, workspaceId, deletedAt: null },
    include: {
      workspace: { select: { enabledViews: true } },
      statusColumns: { orderBy: { order: "asc" } },
      customColumns: { orderBy: { order: "asc" } },
      views: { where: { type: "TABLE", name: null } },
      tasks: {
        where: { deletedAt: null },
        orderBy: [{ statusColumn: { order: "asc" } }, { rowOrder: "asc" }],
        include: taskInclude,
      },
    },
  });
  if (!board) notFound();

  const canEdit = can(ctx.role, "task.update");
  const canCreate = can(ctx.role, "task.create");
  const canManageBoard = can(ctx.role, "board.update");

  const tableView = board.views[0];
  const bgCss = backgroundToCss((tableView?.background ?? null) as BackgroundConfig | null);
  const enabledViews = parseEnabledViews(board.workspace.enabledViews);

  return (
    <BoardShell bgCss={bgCss}>
      <ListStateProvider
        meta={{
          workspaceId,
          boardId: board.id,
          canEdit,
          canManagePrefs: canManageBoard,
          statusColumns: board.statusColumns.map((c) => ({ id: c.id, name: c.name, colorHex: c.colorHex })),
          customColumns: board.customColumns.map((c) => ({ id: c.id, name: c.name, type: c.type as CustomTableColumn["type"], options: c.options })),
          members: memberships.map((m) => m.user),
          allTags,
        }}
        initialConfig={parseListConfig(tableView?.configJson)}
      >
        <BoardHeaderServer
          workspaceId={workspaceId}
          boardId={board.id}
          board={{ name: board.name, description: board.description }}
          active="table"
          enabledViews={enabledViews}
          toolbar={<ListToolbar />}
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
          <BoardTable tasks={board.tasks.map((t) => toTableTask(t, docHasText(t.descriptionJson)))} />
        </ViewTransition>
      </ListStateProvider>
    </BoardShell>
  );
}
