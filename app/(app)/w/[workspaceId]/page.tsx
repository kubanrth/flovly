import Link from "next/link";
import { PencilRuler } from "lucide-react";
import { db } from "@/lib/db";
import { requireWorkspaceMembership } from "@/lib/workspace-guard";
import { can } from "@/lib/permissions";
import { CreateTaskButton } from "@/components/task/create-task-button";
import { AppShell } from "@/components/layout/app-shell";
import {
  computeBoardEnabledViews,
  parseEnabledViews,
} from "@/lib/board-views";
import {
  SortableBoardsGrid,
  SortableBoardsList,
  type BoardSectionData,
} from "@/components/workspaces/sortable-boards";
import { BoardsLayoutToggle } from "@/components/workspaces/boards-layout-toggle";

export default async function WorkspaceOverviewPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const ctx = await requireWorkspaceMembership(workspaceId);

  const [workspace, memberCount, boards] = await Promise.all([
    db.workspace.findUnique({
      where: { id: workspaceId },
      select: { enabledViews: true },
    }),
    db.workspaceMembership.count({ where: { workspaceId } }),
    // ADMIN sees all; MEMBER/VIEWER sees PUBLIC + explicit memberships.
    db.board.findMany({
      where:
        ctx.role === "ADMIN"
          ? { workspaceId, deletedAt: null }
          : {
              workspaceId,
              deletedAt: null,
              OR: [
                { visibility: "PUBLIC" },
                { memberships: { some: { userId: ctx.userId } } },
              ],
            },
      // Honour user-set drag-and-drop order; fall back to createdAt.
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      include: {
        statusColumns: { orderBy: { order: "asc" } },
        views: { select: { type: true, name: true } },
        _count: { select: { tasks: { where: { deletedAt: null } } } },
        tasks: {
          where: { deletedAt: null },
          orderBy: [{ statusColumn: { order: "asc" } }, { rowOrder: "asc" }],
          take: 20,
          include: {
            assignees: {
              include: {
                user: { select: { id: true, name: true, email: true, avatarUrl: true } },
              },
            },
            tags: { include: { tag: true } },
            statusColumn: true,
          },
        },
      },
    }),
  ]);

  const canCreateTask = can(ctx.role, "task.create");
  const firstBoard = boards[0];
  const workspaceEnabled = parseEnabledViews(workspace?.enabledViews);

  const boardSections: BoardSectionData[] = boards.map((board) => {
    const boardDefaultTypes = board.views
      .filter((v) => v.name === null)
      .map((v) => v.type);
    return {
      id: board.id,
      name: board.name,
      taskCount: board._count.tasks,
      enabledViews: computeBoardEnabledViews(workspaceEnabled, boardDefaultTypes),
      tasks: board.tasks.map((task) => ({
        id: task.id,
        title: task.title,
        stopAt: task.stopAt ? task.stopAt.toISOString() : null,
        statusName: task.statusColumn?.name ?? null,
        statusColor: task.statusColumn?.colorHex ?? null,
        assignees: task.assignees.map((a) => ({
          userId: a.userId,
          name: a.user.name,
          email: a.user.email,
          avatarUrl: a.user.avatarUrl,
        })),
        tags: task.tags.map(({ tag }) => ({
          id: tag.id,
          name: tag.name,
          colorHex: tag.colorHex,
        })),
      })),
    };
  });

  return (
    <AppShell>
      <div className="flex flex-col gap-6 md:gap-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Metric label="Członkowie" value={memberCount} />
          <div className="flex items-center gap-2">
            <Link
              href={`/w/${workspaceId}/canvases`}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-3 font-sans text-[0.82rem] font-medium text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <PencilRuler size={14} /> Whiteboard
            </Link>
            {firstBoard && canCreateTask && (
              <CreateTaskButton workspaceId={workspaceId} boardId={firstBoard.id} />
            )}
          </div>
        </div>

        <BoardsLayoutToggle
          grid={<SortableBoardsGrid workspaceId={workspaceId} boards={boardSections} />}
          list={<SortableBoardsList workspaceId={workspaceId} boards={boardSections} />}
        />
      </div>
    </AppShell>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="eyebrow">{label}</span>
      <span className="font-display text-[1.4rem] font-bold leading-none tracking-[-0.02em] md:text-[1.8rem]">
        {value}
      </span>
    </div>
  );
}
