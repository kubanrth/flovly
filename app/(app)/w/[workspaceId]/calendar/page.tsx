import { db } from "@/lib/db";
import { requireWorkspaceMembership } from "@/lib/workspace-guard";
import { WorkspaceCalendar } from "@/components/workspace/workspace-calendar";

// Workspace-wide calendar: every task + custom events visible to all members,
// not only the viewer's assigned tasks.
export default async function WorkspaceCalendarPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  await requireWorkspaceMembership(workspaceId);

  const [workspace, tasks, events] = await Promise.all([
    db.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true, name: true },
    }),
    db.task.findMany({
      where: {
        workspaceId,
        deletedAt: null,
        OR: [{ startAt: { not: null } }, { stopAt: { not: null } }],
      },
      include: {
        statusColumn: { select: { name: true, colorHex: true } },
        board: { select: { name: true } },
      },
    }),
    db.workspaceEvent.findMany({
      where: { workspaceId, deletedAt: null },
      include: { creator: { select: { name: true, email: true } } },
      orderBy: { startAt: "asc" },
    }),
  ]);
  if (!workspace) return null;

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center gap-2.5">
        <h1 className="text-xl font-semibold tracking-[-0.3px]">Kalendarz przestrzeni</h1>
        <span className="mt-1.5 truncate text-xs text-fg-2">{workspace.name}</span>
      </header>
      <p className="max-w-[80ch] text-xs text-fg-2">
        Wszystkie zadania przestrzeni plus własne wydarzenia (spotkania, terminy, praca poza
        zadaniami). Wydarzenia może tworzyć każdy członek.
      </p>

      <WorkspaceCalendar
        workspaceId={workspaceId}
        tasks={tasks.map((t) => ({
          id: t.id,
          title: t.title,
          startAt: t.startAt ? t.startAt.toISOString() : null,
          stopAt: t.stopAt ? t.stopAt.toISOString() : null,
          statusName: t.statusColumn?.name ?? null,
          statusColor: t.statusColumn?.colorHex ?? null,
          boardName: t.board.name,
        }))}
        events={events.map((e) => ({
          id: e.id,
          title: e.title,
          description: e.description,
          startAt: e.startAt.toISOString(),
          endAt: e.endAt.toISOString(),
          allDay: e.allDay,
          color: e.color,
          creatorName: e.creator.name ?? e.creator.email,
        }))}
      />
    </div>
  );
}
