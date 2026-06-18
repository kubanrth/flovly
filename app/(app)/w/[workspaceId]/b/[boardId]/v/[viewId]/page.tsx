import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireWorkspaceMembership } from "@/lib/workspace-guard";
import { can } from "@/lib/permissions";
import { BoardTable, type CustomTableColumn } from "@/components/table/board-table";
import type { TableFilter, TableSort } from "@/lib/table-filters";
import { KanbanBoard } from "@/components/kanban/kanban-board";
import { RoadmapView } from "@/components/roadmap/roadmap-view";
import { GanttView } from "@/components/roadmap/gantt-view";
import { CanvasEditorLazy } from "@/components/canvas/canvas-editor-lazy";
import { CreateTaskButton } from "@/components/task/create-task-button";
import { BackgroundCustomizer } from "@/components/view/background-customizer";
import { BoardShell } from "@/components/view/board-shell";
import { ViewTransition } from "@/components/view/view-transition";
import { BoardHeaderServer } from "@/components/view/board-header-server";
import { docHasText } from "@/lib/prosemirror-text";
import { BoardLinksServer } from "@/components/board/board-links-server";
import { parseEnabledViews, viewTypeToName } from "@/lib/board-views";
import { backgroundToCss, type BackgroundConfig } from "@/lib/schemas/background";

// Unified route for any custom BoardView; renderer is picked by BoardView.type.
export default async function CustomBoardViewPage({
  params,
}: {
  params: Promise<{ workspaceId: string; boardId: string; viewId: string }>;
}) {
  const { workspaceId, boardId, viewId } = await params;
  const ctx = await requireWorkspaceMembership(workspaceId);

  const view = await db.boardView.findFirst({
    where: { id: viewId, boardId },
  });
  if (!view || !view.name) notFound();

  const viewTypeName = viewTypeToName(view.type) ?? "table";
  const background = (view.background ?? null) as BackgroundConfig | null;
  const bgCss = backgroundToCss(background);

  const board = await db.board.findFirst({
    where: { id: boardId, workspaceId, deletedAt: null },
    include: {
      workspace: { select: { enabledViews: true } },
    },
  });
  if (!board) notFound();

  const enabledViews = parseEnabledViews(board.workspace.enabledViews);

  const canCreate = can(ctx.role, "task.create");
  const canEdit = can(ctx.role, "task.update");
  const canManageBoard = can(ctx.role, "board.update");
  const canCustomize = can(ctx.role, "background.customize");

  const actions =
    // F12-K73/78: TASKLINE i CALENDAR jak WHITEBOARD — bez BackgroundCustomizer'a
    // (kanwa lub gęsta siatka, customization niczego nie wnosi).
    view.type === "WHITEBOARD" ||
    view.type === "TASKLINE" ||
    view.type === "CALENDAR" ? null : (
      <>
        {canCustomize && (
          <BackgroundCustomizer
            workspaceId={workspaceId}
            boardId={boardId}
            viewType={view.type}
            initial={background}
          />
        )}
        {canCreate && (
          <CreateTaskButton workspaceId={workspaceId} boardId={boardId} />
        )}
      </>
    );

  return (
    <BoardShell bgCss={bgCss}>
      <BoardHeaderServer
        workspaceId={workspaceId}
        boardId={boardId}
        board={{ name: board.name, description: board.description }}
        active={viewTypeName}
        activeViewId={view.id}
        enabledViews={enabledViews}
        extra={<BoardLinksServer workspaceId={workspaceId} boardId={boardId} />}
        actions={actions}
      />

      <ViewTransition>
      {view.type === "TABLE" && (
        <TableRenderer
          workspaceId={workspaceId}
          boardId={boardId}
          canEdit={canEdit}
          canManageBoard={canManageBoard}
          configJson={view.configJson}
        />
      )}
      {view.type === "KANBAN" && (
        <KanbanRenderer
          workspaceId={workspaceId}
          boardId={boardId}
          canManageBoard={canManageBoard}
        />
      )}
      {view.type === "ROADMAP" && (
        <RoadmapRenderer
          workspaceId={workspaceId}
          boardId={boardId}
          canCreate={can(ctx.role, "milestone.create")}
          canUpdate={can(ctx.role, "milestone.update")}
          canDelete={can(ctx.role, "milestone.delete")}
        />
      )}
      {view.type === "GANTT" && (
        <GanttRenderer workspaceId={workspaceId} boardId={boardId} />
      )}
      {view.type === "WHITEBOARD" && (
        <WhiteboardRenderer
          workspaceId={workspaceId}
          boardId={boardId}
          canEdit={can(ctx.role, "canvas.edit")}
          canCreateTask={canCreate}
          userId={ctx.userId}
          boardName={`${board.name} · ${view.name}`}
        />
      )}
      </ViewTransition>
    </BoardShell>
  );
}

async function TableRenderer({
  workspaceId,
  boardId,
  canEdit,
  canManageBoard,
  configJson,
}: {
  workspaceId: string;
  boardId: string;
  canEdit: boolean;
  canManageBoard: boolean;
  configJson: unknown;
}) {
  const memberships = await db.workspaceMembership.findMany({
    where: { workspaceId },
    include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    orderBy: { joinedAt: "asc" },
  });

  // Same workspace-wide tag list as the default /table route.
  const allTags = await db.tag.findMany({
    where: { OR: [{ workspaceId }, { workspaceId: null }] },
    orderBy: [{ workspaceId: { sort: "desc", nulls: "last" } }, { name: "asc" }],
    select: { id: true, name: true, colorHex: true },
  });

  const board = await db.board.findFirst({
    where: { id: boardId },
    include: {
      statusColumns: { orderBy: { order: "asc" } },
      customColumns: { orderBy: { order: "asc" } },
      tasks: {
        where: { deletedAt: null },
        orderBy: [{ statusColumn: { order: "asc" } }, { rowOrder: "asc" }],
        include: {
          assignees: {
            include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
          },
          tags: { include: { tag: true } },
          customValues: true,
          // Built-in 'Załączniki' column needs file metadata.
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
              linksOut: true,
              linksIn: true,
            },
          },
          subtasks: { select: { completed: true } },
        },
      },
    },
  });
  if (!board) return null;

  const cfg = (configJson ?? {}) as {
    columnOrder?: string[];
    hidden?: string[];
    filters?: unknown;
    sort?: unknown;
    groupBy?: unknown;
    widths?: unknown;
    pinned?: unknown;
  };
  const cfgWidths =
    cfg.widths && typeof cfg.widths === "object"
      ? (cfg.widths as Record<string, number>)
      : undefined;
  const cfgPinned = Array.isArray(cfg.pinned)
    ? (cfg.pinned as string[])
    : undefined;
  const cfgFilters = Array.isArray(cfg.filters)
    ? (cfg.filters as TableFilter[])
    : undefined;
  const cfgSort =
    cfg.sort && typeof cfg.sort === "object"
      ? (cfg.sort as TableSort)
      : cfg.sort === null
        ? null
        : undefined;
  const cfgGroupBy =
    typeof cfg.groupBy === "string" || cfg.groupBy === null
      ? (cfg.groupBy as string | null)
      : undefined;

  return (
    <BoardTable
      workspaceId={workspaceId}
      boardId={boardId}
      statusColumns={board.statusColumns.map((c) => ({
        id: c.id,
        name: c.name,
        colorHex: c.colorHex,
      }))}
      tasks={board.tasks.map((t) => ({
        id: t.id,
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
      initialColumnOrder={Array.isArray(cfg.columnOrder) ? cfg.columnOrder : undefined}
      initialHiddenColumns={Array.isArray(cfg.hidden) ? cfg.hidden : undefined}
      initialFilters={cfgFilters}
      initialSort={cfgSort}
      initialGroupBy={cfgGroupBy}
      initialWidths={cfgWidths}
      initialPinned={cfgPinned}
      customColumns={board.customColumns.map((c) => ({
        id: c.id,
        name: c.name,
        type: c.type as CustomTableColumn["type"],
        options: c.options,
      }))}
      members={memberships.map((m) => m.user)}
      allTags={allTags}
    />
  );
}

async function KanbanRenderer({
  workspaceId,
  boardId,
  canManageBoard,
}: {
  workspaceId: string;
  boardId: string;
  canManageBoard: boolean;
}) {
  const [board, memberships] = await Promise.all([
    db.board.findFirst({
      where: { id: boardId },
      include: {
        statusColumns: { orderBy: { order: "asc" } },
        tasks: {
          where: { deletedAt: null },
          orderBy: [{ statusColumn: { order: "asc" } }, { rowOrder: "asc" }],
          include: {
            assignees: {
              include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
            },
            tags: { include: { tag: true } },
            _count: {
              select: {
                comments: { where: { deletedAt: null } },
                linksOut: true,
                linksIn: true,
              },
            },
            subtasks: { select: { completed: true } },
          },
        },
      },
    }),
    db.workspaceMembership.findMany({
      where: { workspaceId },
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
      orderBy: { joinedAt: "asc" },
    }),
  ]);
  if (!board) return null;
  return (
    <KanbanBoard
      workspaceId={workspaceId}
      boardId={boardId}
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
        priority: t.priority,
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
        subtaskCount: t.subtasks.length,
        subtaskDoneCount: t.subtasks.filter((s) => s.completed).length,
        linkedCount: t._count.linksOut + t._count.linksIn,
      }))}
      members={memberships.map((m) => m.user)}
    />
  );
}

async function RoadmapRenderer({
  workspaceId,
  boardId,
  canCreate,
  canUpdate,
  canDelete,
}: {
  workspaceId: string;
  boardId: string;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}) {
  const [board, memberships] = await Promise.all([
    db.board.findFirst({
      where: { id: boardId },
      include: {
        milestones: {
          where: { deletedAt: null },
          orderBy: [{ orderIndex: "asc" }, { startAt: "asc" }],
          include: {
            assignee: { select: { id: true, name: true, email: true, avatarUrl: true } },
            tasks: {
              where: { deletedAt: null },
              select: { id: true, title: true, statusColumnId: true },
            },
          },
        },
      },
    }),
    db.workspaceMembership.findMany({
      where: { workspaceId },
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
      orderBy: { joinedAt: "asc" },
    }),
  ]);
  if (!board) return null;
  return (
    <RoadmapView
      workspaceId={workspaceId}
      boardId={boardId}
      members={memberships.map((m) => m.user)}
      milestones={board.milestones.map((m) => ({
        id: m.id,
        title: m.title,
        startAt: m.startAt.toISOString(),
        stopAt: m.stopAt.toISOString(),
        assignee: m.assignee,
        taskCount: m.tasks.length,
        tasks: m.tasks.map((t) => ({ id: t.id, title: t.title })),
        // Cross-board aggregation lives on the default roadmap route, not on
        // custom views — those stay scoped to the host board's milestones.
        linkedChildren: [],
      }))}
      canCreate={canCreate}
      canUpdate={canUpdate}
      canDelete={canDelete}
      isAggregator={false}
      canManageBoard={false}
      workspaceMilestones={[]}
    />
  );
}

async function GanttRenderer({
  workspaceId,
  boardId,
}: {
  workspaceId: string;
  boardId: string;
}) {
  const board = await db.board.findFirst({
    where: { id: boardId },
    include: {
      tasks: {
        where: { deletedAt: null },
        orderBy: [{ startAt: "asc" }, { rowOrder: "asc" }],
        include: {
          statusColumn: { select: { name: true, colorHex: true } },
          assignees: {
            include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
            take: 1,
          },
        },
      },
    },
  });
  if (!board) return null;
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
    <GanttView
      workspaceId={workspaceId}
      scheduled={scheduled}
      unscheduled={unscheduled}
    />
  );
}

async function WhiteboardRenderer({
  workspaceId,
  boardId,
  canEdit,
  canCreateTask,
  userId,
  boardName,
}: {
  workspaceId: string;
  boardId: string;
  canEdit: boolean;
  canCreateTask: boolean;
  userId: string;
  boardName: string;
}) {
  // Custom whiteboards share the per-board canvas with the default /whiteboard
  // route — same drawing, just reachable through a labelled pill.
  let canvas = await db.processCanvas.findFirst({
    where: { boardId, deletedAt: null },
    include: {
      nodes: {
        include: {
          taskLinks: { include: { task: { select: { id: true, title: true, deletedAt: true } } } },
        },
      },
      edges: true,
    },
  });
  if (!canvas) {
    canvas = await db.processCanvas.create({
      data: { workspaceId, boardId, name: boardName, creatorId: userId },
      include: {
        nodes: {
          include: {
            taskLinks: { include: { task: { select: { id: true, title: true, deletedAt: true } } } },
          },
        },
        edges: true,
      },
    });
  }

  const boardTasks = await db.task.findMany({
    where: { boardId, deletedAt: null },
    orderBy: { updatedAt: "desc" },
    take: 300,
    select: { id: true, title: true },
  });

  const linksByNode = new Map<string, { taskId: string; title: string }[]>();
  for (const n of canvas.nodes) {
    const alive = n.taskLinks
      .filter((l) => l.task && !l.task.deletedAt)
      .map((l) => ({ taskId: l.task.id, title: l.task.title }));
    if (alive.length > 0) linksByNode.set(n.id, alive);
  }

  return (
    <div className="h-[calc(100dvh-18rem)] min-h-[520px] overflow-hidden rounded-xl border border-border bg-card">
      <CanvasEditorLazy
        workspaceId={workspaceId}
        canvasId={canvas.id}
        initialNodes={canvas.nodes.map((n) => ({
          id: n.id,
          shape: n.shape === "ICON" ? "RECTANGLE" : n.shape,
          label: n.label,
          x: n.x,
          y: n.y,
          width: n.width,
          height: n.height,
          colorHex: n.colorHex,
          linkedTasks: linksByNode.get(n.id) ?? [],
        }))}
        initialEdges={canvas.edges.map((e) => ({
          id: e.id,
          fromNodeId: e.fromNodeId,
          toNodeId: e.toNodeId,
          label: e.label,
          style: e.style === "dashed" ? "dashed" : "solid",
        }))}
        canEdit={canEdit}
        canCreateTask={canCreateTask}
        workspaceTasks={boardTasks}
        defaultBoardId={boardId}
      />
    </div>
  );
}
