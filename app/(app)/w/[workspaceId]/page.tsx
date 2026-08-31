import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireWorkspaceMembership } from "@/lib/workspace-guard";
import { can } from "@/lib/permissions";
import { parseEnabledViews } from "@/lib/board-views";
import { activityPhrase } from "@/components/summary/aggregate";
import { Button } from "@/components/ui/button";
import { IconContacts } from "@/components/ui/icons";
import { WorkspaceHeader } from "@/components/workspace/workspace-header";
import { BoardsGrid } from "@/components/workspace/boards-grid";
import { NewBoardButton } from "@/components/workspace/new-board-button";
import { WorkspaceActivity, type WorkspaceActivityEntry } from "@/components/workspace/workspace-activity";
import type { BoardCardData } from "@/components/workspace/board-card";
import { activityStamp, boardStats, overviewFooter, workspaceMeta } from "@/components/workspace/overview-model";

// C1 „Przestrzeń”: header (letter tile, name, meta, avatars, actions) + tabs +
// boards grid + workspace activity + footer counters.
export default async function WorkspaceOverviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string }>;
  searchParams: Promise<{ new?: string }>;
}) {
  const { workspaceId } = await params;
  const { new: newParam } = await searchParams;
  const ctx = await requireWorkspaceMembership(workspaceId);

  const [workspace, memberships, boards, audit] = await Promise.all([
    db.workspace.findFirst({
      where: { id: workspaceId, deletedAt: null },
      select: { id: true, name: true, slug: true, description: true, createdAt: true, enabledViews: true },
    }),
    db.workspaceMembership.findMany({
      where: { workspaceId },
      orderBy: { joinedAt: "asc" },
      select: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    }),
    // ADMIN sees all; MEMBER/VIEWER sees PUBLIC + explicit membership.
    db.board.findMany({
      where:
        ctx.role === "ADMIN"
          ? { workspaceId, deletedAt: null }
          : {
              workspaceId,
              deletedAt: null,
              OR: [{ visibility: "PUBLIC" }, { memberships: { some: { userId: ctx.userId } } }],
            },
      // Honour drag-and-drop order; fall back to createdAt.
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        name: true,
        statusColumns: { orderBy: { order: "asc" }, select: { id: true, name: true, order: true } },
        tasks: {
          where: { deletedAt: null },
          select: {
            statusColumnId: true,
            stopAt: true,
            assignees: { select: { userId: true } },
          },
        },
      },
    }),
    db.auditLog.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: {
        id: true,
        objectType: true,
        objectId: true,
        action: true,
        createdAt: true,
        actor: { select: { name: true, email: true, avatarUrl: true } },
      },
    }),
  ]);
  if (!workspace) notFound();

  const now = new Date();
  const memberById = new Map(
    memberships.map((m) => [m.user.id, { name: m.user.name ?? m.user.email, avatarUrl: m.user.avatarUrl }]),
  );
  const dayMonth = new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "short" });
  const cards: BoardCardData[] = boards.map((board) => {
    // Card avatars = people assigned to this board's tasks, in first-seen order.
    const people = new Map<string, { name: string; avatarUrl: string | null }>();
    for (const task of board.tasks) {
      for (const { userId } of task.assignees) {
        const member = memberById.get(userId);
        if (member && !people.has(userId)) people.set(userId, member);
      }
    }
    const stats = boardStats(
      board.tasks.map((t) => ({ statusColumnId: t.statusColumnId, stopAt: t.stopAt?.toISOString() ?? null })),
      board.statusColumns,
      now,
    );
    return {
      id: board.id,
      name: board.name,
      stats,
      people: [...people.values()],
      dueLabel: stats.nextDue ? `termin ${dayMonth.format(new Date(stats.nextDue))}` : null,
    };
  });

  const totalTasks = cards.reduce((sum, c) => sum + c.stats.total, 0);
  const openTasks = cards.reduce((sum, c) => sum + c.stats.open, 0);

  // Activity targets: only objects this member can see (visible boards + their tasks).
  const boardById = new Map(boards.map((b) => [b.id, b]));
  const auditTaskIds = audit.filter((a) => a.objectType === "Task").map((a) => a.objectId);
  const auditTasks =
    auditTaskIds.length > 0
      ? await db.task.findMany({
          where: { id: { in: auditTaskIds }, deletedAt: null, boardId: { in: boards.map((b) => b.id) } },
          select: { id: true, title: true },
        })
      : [];
  const taskById = new Map(auditTasks.map((t) => [t.id, t]));
  const activity: WorkspaceActivityEntry[] = audit.map((e) => {
    const task = taskById.get(e.objectId);
    const board = boardById.get(e.objectId);
    return {
      id: e.id,
      actorName: e.actor?.name ?? e.actor?.email ?? "System",
      actorAvatarUrl: e.actor?.avatarUrl ?? null,
      phrase: activityPhrase(e.action),
      target:
        task ? { label: task.title, href: `/w/${workspaceId}/t/${task.id}` }
        : board ? { label: board.name, href: `/w/${workspaceId}/b/${board.id}/table` }
        : null,
      time: activityStamp(e.createdAt, now),
    };
  });

  const canCreateBoard = can(ctx.role, "board.create");
  const enabledViews = parseEnabledViews(workspace.enabledViews).map((v) => v.toUpperCase());

  return (
    <div className="flex h-[calc(100dvh-var(--topbar))] flex-col bg-card">
      <WorkspaceHeader
        bleed
        workspace={{ id: workspace.id, name: workspace.name, slug: workspace.slug, description: workspace.description }}
        canEditSettings={can(ctx.role, "workspace.updateSettings")}
        meta={workspaceMeta(boards.length, memberships.length, workspace.createdAt)}
        members={memberships.map((m) => ({
          id: m.user.id,
          name: m.user.name ?? m.user.email,
          avatarUrl: m.user.avatarUrl,
        }))}
        actions={
          <>
            <Button variant="secondary" render={<Link href={`/w/${workspaceId}/members`} />}>
              <IconContacts />
              Zaproś
            </Button>
            {canCreateBoard && <NewBoardButton workspaceId={workspaceId} enabledViews={enabledViews} />}
          </>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto bg-canvas px-8 py-5 max-md:px-4">
        <div className="mb-5">
          <BoardsGrid
            workspaceId={workspaceId}
            boards={cards}
            canCreate={canCreateBoard}
            enabledViews={enabledViews}
            autoOpenCreate={newParam === "board"}
          />
        </div>
        <WorkspaceActivity entries={activity} />
      </div>

      <footer className="flex h-8 shrink-0 items-center border-t border-border bg-canvas px-8 font-mono text-2xs text-muted-foreground max-md:px-4">
        {overviewFooter(boards.length, totalTasks, openTasks)}
      </footer>
    </div>
  );
}
