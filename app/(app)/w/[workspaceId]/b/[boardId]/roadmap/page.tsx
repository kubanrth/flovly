import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireWorkspaceMembership } from "@/lib/workspace-guard";
import { can } from "@/lib/permissions";
import { RoadmapView } from "@/components/roadmap/roadmap-view";
import { BackgroundCustomizer } from "@/components/view/background-customizer";
import { BoardShell } from "@/components/view/board-shell";
import { ViewTransition } from "@/components/view/view-transition";
import { BoardHeaderServer } from "@/components/view/board-header-server";
import { BoardLinksServer } from "@/components/board/board-links-server";
import { parseEnabledViews } from "@/lib/board-views";
import { backgroundToCss, type BackgroundConfig } from "@/lib/schemas/background";

export default async function RoadmapPage({
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
      views: { where: { type: "ROADMAP" } },
      milestones: {
        where: { deletedAt: null },
        orderBy: [{ orderIndex: "asc" }, { startAt: "asc" }],
        include: {
          assignee: { select: { id: true, name: true, email: true, avatarUrl: true } },
          tasks: {
            where: { deletedAt: null },
            select: {
              id: true,
              title: true,
              statusColumnId: true,
            },
          },
          // Aggregator side: children of this milestone (other boards' milestones
          // it aggregates). We filter out deleted children at query time since
          // soft-deletes leave the link row behind.
          parentLinks: {
            where: { child: { deletedAt: null, board: { deletedAt: null } } },
            include: {
              child: {
                select: {
                  id: true,
                  title: true,
                  startAt: true,
                  stopAt: true,
                  boardId: true,
                  board: { select: { name: true } },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!board) notFound();

  // When this board is an aggregator, fetch other boards' milestones to feed
  // the linker picker. Skipped when the flag is off so non-aggregator pages
  // don't pay for it.
  const workspaceMilestones = board.isAggregator
    ? await db.board.findMany({
        where: {
          workspaceId,
          deletedAt: null,
          id: { not: boardId },
        },
        select: {
          id: true,
          name: true,
          milestones: {
            where: { deletedAt: null },
            orderBy: [{ startAt: "asc" }],
            select: { id: true, title: true, startAt: true, stopAt: true },
          },
        },
        orderBy: { name: "asc" },
      })
    : [];

  const memberships = await db.workspaceMembership.findMany({
    where: { workspaceId },
    include: {
      user: { select: { id: true, name: true, email: true, avatarUrl: true } },
    },
    orderBy: { joinedAt: "asc" },
  });

  const roadmapView = board.views[0];
  const background = (roadmapView?.background ?? null) as BackgroundConfig | null;
  const bgCss = backgroundToCss(background);
  const canCreate = can(ctx.role, "milestone.create");
  const canUpdate = can(ctx.role, "milestone.update");
  const canDelete = can(ctx.role, "milestone.delete");
  const canCustomize = can(ctx.role, "background.customize");
  const canManageBoard = can(ctx.role, "board.update");
  const enabledViews = parseEnabledViews(board.workspace.enabledViews);

  return (
    <BoardShell bgCss={bgCss}>
      <BoardHeaderServer
        workspaceId={workspaceId}
        boardId={boardId}
        board={{ name: board.name, description: board.description }}
        active="roadmap"
        enabledViews={enabledViews}
        extra={<BoardLinksServer workspaceId={workspaceId} boardId={boardId} />}
        actions={
          canCustomize && roadmapView ? (
            <BackgroundCustomizer
              workspaceId={workspaceId}
              boardId={boardId}
              viewType="ROADMAP"
              initial={background}
            />
          ) : null
        }
      />

      <ViewTransition>
      <RoadmapView
        workspaceId={workspaceId}
        boardId={boardId}
        members={memberships.map((m) => m.user)}
        isAggregator={board.isAggregator}
        canManageBoard={canManageBoard}
        workspaceMilestones={workspaceMilestones.map((b) => ({
          boardId: b.id,
          boardName: b.name,
          milestones: b.milestones.map((m) => ({
            id: m.id,
            title: m.title,
            startAt: m.startAt.toISOString(),
            stopAt: m.stopAt.toISOString(),
          })),
        }))}
        milestones={board.milestones.map((m) => ({
          id: m.id,
          title: m.title,
          startAt: m.startAt.toISOString(),
          stopAt: m.stopAt.toISOString(),
          assignee: m.assignee,
          taskCount: m.tasks.length,
          tasks: m.tasks.map((t) => ({ id: t.id, title: t.title })),
          linkedChildren: m.parentLinks.map((l) => ({
            linkId: l.id,
            id: l.child.id,
            title: l.child.title,
            startAt: l.child.startAt.toISOString(),
            stopAt: l.child.stopAt.toISOString(),
            boardId: l.child.boardId,
            boardName: l.child.board.name,
          })),
        }))}
        canCreate={canCreate}
        canUpdate={canUpdate}
        canDelete={canDelete}
      />
      </ViewTransition>
    </BoardShell>
  );
}
