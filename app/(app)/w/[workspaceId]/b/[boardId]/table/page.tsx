import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireWorkspaceMembership } from "@/lib/workspace-guard";
import { can } from "@/lib/permissions";
import { BoardTable, type CustomTableColumn } from "@/components/table/board-table";
import type { TableFilter, TableSort } from "@/lib/table-filters";
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
      views: { where: { type: "TABLE" } },
      tasks: {
        where: { deletedAt: null },
        orderBy: [{ statusColumn: { order: "asc" } }, { rowOrder: "asc" }],
        include: {
          assignees: {
            include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
          },
          tags: { include: { tag: true } },
          customValues: true,
          // Slim include for the 'Załączniki' column; full metadata loads in task-detail.
          attachments: {
            where: { deletedAt: null },
            select: {
              id: true,
              filename: true,
              mimeType: true,
              sizeBytes: true,
            },
            orderBy: { createdAt: "desc" },
          },
          _count: {
            select: {
              comments: { where: { deletedAt: null } },
              // Liczymy obie strony relacji TaskLink — link jest symetryczny w
              // UI; sumujemy w mapowaniu zanim wyślemy do klienta.
              linksOut: true,
              linksIn: true,
            },
          },
          // Cheap per-task fetch — most tasks have a handful of subtasks. We
          // need both total + done count for the table hint, so a boolean
          // projection is simplest (Prisma _count doesn't easily expose two
          // filtered counts on the same relation).
          subtasks: { select: { completed: true } },
        },
      },
    },
  });
  if (!board) notFound();

  const canEdit = can(ctx.role, "task.update");
  const canCreate = can(ctx.role, "task.create");
  const canManageBoard = can(ctx.role, "board.update");

  const tableView = board.views[0];
  const background = (tableView?.background ?? null) as BackgroundConfig | null;
  const bgCss = backgroundToCss(background);
  const enabledViews = parseEnabledViews(board.workspace.enabledViews);

  // Legacy boards may lack columnOrder/hidden/filters/sort/groupBy — fall back to defaults.
  const tableConfig = (tableView?.configJson ?? {}) as {
    columnOrder?: string[];
    hidden?: string[];
    filters?: unknown;
    sort?: unknown;
    groupBy?: unknown;
    widths?: unknown;
    pinned?: unknown;
  };
  const initialWidths =
    tableConfig.widths && typeof tableConfig.widths === "object"
      ? (tableConfig.widths as Record<string, number>)
      : undefined;
  const initialPinned = Array.isArray(tableConfig.pinned)
    ? (tableConfig.pinned as string[])
    : undefined;
  // Shape is validated on write, but legacy/hand-edited rows can differ — guard on read.
  const initialFilters = Array.isArray(tableConfig.filters)
    ? (tableConfig.filters as TableFilter[])
    : undefined;
  const initialSort =
    tableConfig.sort && typeof tableConfig.sort === "object"
      ? (tableConfig.sort as TableSort)
      : tableConfig.sort === null
        ? null
        : undefined;
  const initialGroupBy =
    typeof tableConfig.groupBy === "string" || tableConfig.groupBy === null
      ? (tableConfig.groupBy as string | null)
      : undefined;

  return (
    <BoardShell bgCss={bgCss}>
      <BoardHeaderServer
        workspaceId={workspaceId}
        boardId={board.id}
        board={{ name: board.name, description: board.description }}
        active="table"
        enabledViews={enabledViews}
        extra={<BoardLinksServer workspaceId={workspaceId} boardId={board.id} />}
        actions={
          <>
            <ShareBoardButton workspaceId={workspaceId} boardId={board.id} />
            {canCreate && (
              <>
                <ImportTasksDialog
                  workspaceId={workspaceId}
                  boardId={board.id}
                />
                <CreateTaskButton workspaceId={workspaceId} boardId={board.id} />
              </>
            )}
          </>
        }
      />

      <ViewTransition>
      <BoardTable
        workspaceId={workspaceId}
        boardId={board.id}
        statusColumns={board.statusColumns.map((c) => ({
          id: c.id,
          name: c.name,
          colorHex: c.colorHex,
        }))}
        tasks={board.tasks.map((t) => ({
          id: t.id,
          displayId: t.displayId,
          title: t.title,
          statusColumnId: t.statusColumnId,
          priority: t.priority,
          startAt: t.startAt ? t.startAt.toISOString() : null,
          stopAt: t.stopAt ? t.stopAt.toISOString() : null,
          createdAt: t.createdAt.toISOString(),
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
          customValues: Object.fromEntries(
            t.customValues.map((v) => [v.columnId, v.valueText ?? ""]),
          ),
          attachments: t.attachments.map((a) => ({
            id: a.id,
            filename: a.filename,
            mimeType: a.mimeType,
            sizeBytes: a.sizeBytes,
          })),
          hasDescription: docHasText(t.descriptionJson),
          commentCount: t._count.comments,
          subtaskCount: t.subtasks.length,
          subtaskDoneCount: t.subtasks.filter((s) => s.completed).length,
          linkedCount: t._count.linksOut + t._count.linksIn,
        }))}
        canEdit={canEdit}
        canManagePrefs={canManageBoard}
        initialColumnOrder={Array.isArray(tableConfig.columnOrder) ? tableConfig.columnOrder : undefined}
        initialHiddenColumns={Array.isArray(tableConfig.hidden) ? tableConfig.hidden : undefined}
        initialFilters={initialFilters}
        initialSort={initialSort}
        initialGroupBy={initialGroupBy}
        initialWidths={initialWidths}
        initialPinned={initialPinned}
        customColumns={board.customColumns.map((c) => ({
          id: c.id,
          name: c.name,
          type: c.type as CustomTableColumn["type"],
          options: c.options,
        }))}
        members={memberships.map((m) => m.user)}
        allTags={allTags}
      />
      </ViewTransition>

    </BoardShell>
  );
}
