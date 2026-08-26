import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireWorkspaceMembership } from "@/lib/workspace-guard";
import { BoardShell } from "@/components/view/board-shell";
import { ViewTransition } from "@/components/view/view-transition";
import { BoardHeaderServer } from "@/components/view/board-header-server";
import { parseEnabledViews } from "@/lib/board-views";
import { backgroundToCss, type BackgroundConfig } from "@/lib/schemas/background";
import { BoardSummary, type ActivityEntry } from "@/components/summary/board-summary";
import { activityPhrase, activityTime, summarize } from "@/components/summary/aggregate";

// B8 „Podsumowanie” — read-only board dashboard. Same scoping as /overview:
// workspace membership is the boundary, board must belong to the workspace.
export default async function BoardSummaryPage({
  params,
}: {
  params: Promise<{ workspaceId: string; boardId: string }>;
}) {
  const { workspaceId, boardId } = await params;
  await requireWorkspaceMembership(workspaceId);

  const [board, memberships] = await Promise.all([
    db.board.findFirst({
      where: { id: boardId, workspaceId, deletedAt: null },
      include: {
        workspace: { select: { enabledViews: true } },
        statusColumns: { orderBy: { order: "asc" }, select: { id: true, name: true, colorHex: true, order: true } },
        tasks: {
          where: { deletedAt: null },
          select: { id: true, displayId: true, statusColumnId: true, stopAt: true, assignees: { select: { userId: true } } },
        },
        milestones: {
          where: { deletedAt: null },
          orderBy: [{ stopAt: "asc" }],
          select: { id: true, title: true, stopAt: true, tasks: { where: { deletedAt: null }, select: { statusColumnId: true } } },
        },
      },
    }),
    db.workspaceMembership.findMany({
      where: { workspaceId },
      orderBy: { joinedAt: "asc" },
      select: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    }),
  ]);
  if (!board) notFound();

  const now = new Date();
  const summary = summarize({
    now,
    tasks: board.tasks.map((t) => ({
      id: t.id,
      displayId: t.displayId,
      statusColumnId: t.statusColumnId,
      stopAt: t.stopAt ? t.stopAt.toISOString() : null,
      assigneeIds: t.assignees.map((a) => a.userId),
    })),
    statuses: board.statusColumns,
    members: memberships.map((m) => ({ id: m.user.id, name: m.user.name ?? m.user.email, avatarUrl: m.user.avatarUrl })),
    milestones: board.milestones.map((m) => ({
      id: m.id,
      title: m.title,
      stopAt: m.stopAt.toISOString(),
      taskStatusIds: m.tasks.map((t) => t.statusColumnId),
    })),
  });

  // Board-scoped slice of the workspace audit trail: the board row itself plus
  // its tasks and milestones (AuditLog is polymorphic, no boardId column).
  const taskById = new Map(board.tasks.map((t) => [t.id, t]));
  const auditIds = [board.id, ...board.tasks.map((t) => t.id), ...board.milestones.map((m) => m.id)];
  const audit = await db.auditLog.findMany({
    // objectType zawężony, żeby zapytanie trzymało się indeksu
    // [workspaceId, objectType, objectId, createdAt desc].
    where: { workspaceId, objectType: { in: ["Task", "Board", "Milestone"] }, objectId: { in: auditIds } },
    orderBy: { createdAt: "desc" },
    take: 4,
    select: {
      id: true,
      objectId: true,
      action: true,
      createdAt: true,
      actor: { select: { name: true, email: true, avatarUrl: true } },
    },
  });
  const activity: ActivityEntry[] = audit.map((e) => {
    const task = taskById.get(e.objectId);
    return {
      id: e.id,
      actorName: e.actor?.name ?? e.actor?.email ?? "System",
      actorAvatarUrl: e.actor?.avatarUrl ?? null,
      phrase: activityPhrase(e.action),
      task: task ? { id: task.id, displayId: task.displayId } : null,
      time: activityTime(e.createdAt, now),
    };
  });

  const enabledViews = parseEnabledViews(board.workspace.enabledViews);
  const bgCss = backgroundToCss((board as unknown as { background?: BackgroundConfig | null }).background ?? null);

  return (
    <BoardShell bgCss={bgCss}>
      <BoardHeaderServer
        workspaceId={workspaceId}
        boardId={board.id}
        board={{ name: board.name, description: board.description }}
        enabledViews={enabledViews}
      />
      <ViewTransition>
        <BoardSummary
          workspaceId={workspaceId}
          boardId={board.id}
          summary={summary}
          activity={activity}
          generatedAt={now.toLocaleString("pl-PL", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
        />
      </ViewTransition>
    </BoardShell>
  );
}
