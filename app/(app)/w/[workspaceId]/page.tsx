import Link from "next/link";
import { PencilRuler } from "lucide-react";
import { db } from "@/lib/db";
import { requireWorkspaceMembership } from "@/lib/workspace-guard";
import { can } from "@/lib/permissions";
import { CreateTaskButton } from "@/components/task/create-task-button";
import { ViewSwitcher } from "@/components/view/view-switcher";
import { AppShell } from "@/components/layout/app-shell";
import { computeBoardEnabledViews, parseEnabledViews } from "@/lib/board-views";
import { taskPl } from "@/lib/pluralize";

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
    // F12-K8: filter boards by visibility. Workspace ADMIN sees all;
    // MEMBER/VIEWER sees only PUBLIC boards or those they have an
    // explicit membership on. Done at query time so we don't fetch
    // tasks for boards we won't render.
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
      orderBy: { createdAt: "asc" },
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
              include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
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

  return (
    <AppShell>
      <div className="flex flex-col gap-10">
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

      {boards.map((board) => {
        // F9-10: same pill set & filtering as board pages — intersection
        // of workspace.enabledViews with the types this board actually
        // has BoardView rows for.
        const boardDefaultTypes = board.views
          .filter((v) => v.name === null)
          .map((v) => v.type);
        const boardEnabled = computeBoardEnabledViews(workspaceEnabled, boardDefaultTypes);
        return (
        <section key={board.id} className="flex flex-col gap-4 md:gap-5">
          <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:justify-between">
            <h2 className="font-display text-[1.2rem] font-bold leading-[1.15] tracking-[-0.02em] md:text-[1.5rem]">
              <Link
                href={`/w/${workspaceId}/b/${board.id}/table`}
                className="transition-colors hover:text-primary"
              >
                {board.name}
              </Link>
              <span className="ml-3 font-mono text-[0.7rem] font-normal uppercase tracking-[0.14em] text-muted-foreground">
                {board._count.tasks} {taskPl(board._count.tasks)}
              </span>
            </h2>
            <ViewSwitcher
              workspaceId={workspaceId}
              boardId={board.id}
              enabled={boardEnabled}
            />
          </div>

          {board.tasks.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground">
              <p className="font-display text-[1.05rem] font-semibold">Brak zadań.</p>
              <p className="mt-1 font-mono text-[0.7rem] uppercase tracking-[0.14em]">
                zacznij od przycisku „Nowe zadanie” powyżej
              </p>
            </div>
          ) : (
            <ul className="flex flex-col rounded-xl border border-border bg-card overflow-hidden">
              {board.tasks.map((task) => (
                <li key={task.id} className="border-b border-border last:border-b-0">
                  <Link
                    href={`/w/${workspaceId}/t/${task.id}`}
                    className="group flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-accent/60 focus-visible:bg-accent/60 focus-visible:outline-none"
                  >
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <div className="flex items-center gap-2">
                        {task.statusColumn && (
                          <span
                            className="inline-flex h-5 items-center rounded-full px-2 font-mono text-[0.6rem] uppercase tracking-[0.12em] font-semibold"
                            style={{
                              color: task.statusColumn.colorHex,
                              background: `${task.statusColumn.colorHex}22`,
                            }}
                          >
                            {task.statusColumn.name}
                          </span>
                        )}
                        {task.tags.map(({ tag }) => (
                          <span
                            key={tag.id}
                            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.7rem] font-medium"
                            style={{
                              background: `${tag.colorHex}1A`,
                              color: tag.colorHex,
                            }}
                          >
                            <span className="h-1.5 w-1.5 rounded-full" style={{ background: tag.colorHex }} />
                            {tag.name}
                          </span>
                        ))}
                      </div>
                      <span className="truncate font-display text-[0.98rem] font-semibold leading-tight tracking-[-0.01em] transition-colors group-hover:text-primary">
                        {task.title}
                      </span>
                    </div>

                    <div className="flex shrink-0 items-center gap-3">
                      {task.assignees.length > 0 && (
                        <div className="flex -space-x-1.5">
                          {task.assignees.slice(0, 3).map((a) => (
                            <span
                              key={a.userId}
                              className="grid h-6 w-6 place-items-center overflow-hidden rounded-full border-2 border-background bg-brand-gradient font-display text-[0.6rem] font-bold text-white"
                              title={a.user.name ?? a.user.email}
                            >
                              {a.user.avatarUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={a.user.avatarUrl} alt="" className="h-full w-full object-cover" />
                              ) : (
                                (a.user.name ?? a.user.email).slice(0, 2).toUpperCase()
                              )}
                            </span>
                          ))}
                        </div>
                      )}
                      {task.stopAt && (
                        <span className="font-mono text-[0.7rem] uppercase tracking-[0.12em] text-muted-foreground">
                          do {new Date(task.stopAt).toLocaleDateString("pl-PL")}
                        </span>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        );
      })}

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

