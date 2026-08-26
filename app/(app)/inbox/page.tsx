import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { InboxView } from "@/components/inbox/inbox-view";
import { dayBucket, dueLabel, whenLabel, type InboxItem, type InboxTaskRef } from "@/components/inbox/inbox-model";
import type { TaskPriorityValue } from "@/lib/task-priority";

// Every payload shape the notification writers emit (lib/mentions.ts,
// lib/notify-task-event.ts, t/actions.ts, poll-actions.ts, support/actions.ts).
interface Payload {
  workspaceId?: string;
  taskId?: string;
  taskTitle?: string;
  boardName?: string | null;
  authorName?: string | null;
  actorName?: string | null;
  snippet?: string;
  question?: string;
  ticketId?: string;
  ticketTitle?: string;
  status?: string;
  fromStatusName?: string | null;
  toStatusName?: string | null;
}

const SUPPORT = new Set(["support.created", "support.assigned", "support.resolved"]);

export default async function InboxPage() {
  const session = await auth();
  const userId = session!.user.id;

  // One membership query feeds both the notification workspace filter and the
  // assign-hotkey roster — full roster contains active workspaces, so derive
  // both sets in memory.
  const memberships = await db.workspaceMembership.findMany({
    where: { workspace: { deletedAt: null, memberships: { some: { userId } } } },
    include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
  });
  const activeWorkspaceIds = new Set(memberships.filter((m) => m.userId === userId).map((m) => m.workspaceId));

  const all = await db.notification.findMany({
    where: { userId },
    orderBy: [{ createdAt: "desc" }],
    take: 200,
  });
  // Keep notifications without workspace context or that point to a live
  // workspace the user is a member of; drop everything else.
  const notifications = all.filter((n) => {
    const ws = (n.payload as Payload | null)?.workspaceId;
    return !ws || activeWorkspaceIds.has(ws);
  });

  const taskIds = Array.from(
    new Set(notifications.map((n) => (n.payload as Payload | null)?.taskId).filter((x): x is string => !!x)),
  );
  const tasks = taskIds.length
    ? await db.task.findMany({
        where: { id: { in: taskIds }, deletedAt: null },
        select: {
          id: true,
          workspaceId: true,
          displayId: true,
          title: true,
          stopAt: true,
          priority: true,
          statusColumn: { select: { name: true, colorHex: true } },
          board: { select: { name: true } },
          assignees: { select: { userId: true } },
        },
      })
    : [];
  const taskById = new Map(tasks.map((t) => [t.id, t]));

  // Union of every workspace member so the hotkey popup works across workspaces.
  // toggleAssigneeAction re-validates membership server-side.
  const memberMap = new Map<string, { id: string; name: string | null; email: string; avatarUrl: string | null }>();
  for (const m of memberships) if (!memberMap.has(m.user.id)) memberMap.set(m.user.id, m.user);
  const members = Array.from(memberMap.values()).sort((a, b) => (a.name ?? a.email).localeCompare(b.name ?? b.email));

  // Day buckets and labels are resolved here (fixed Europe/Warsaw zone) so SSR
  // and hydration agree even when the container clock runs in UTC.
  const now = new Date();

  const items: InboxItem[] = notifications.map((n) => {
    const p = (n.payload ?? {}) as Payload;
    const row = p.taskId ? taskById.get(p.taskId) : undefined;
    const overdue = row?.stopAt && row.stopAt < now ? dueLabel(row.stopAt, now) : null;
    const task: InboxTaskRef | null = row
      ? {
          id: row.id,
          workspaceId: row.workspaceId,
          displayId: row.displayId,
          title: row.title,
          dueAt: row.stopAt?.toISOString() ?? null,
          dueText: overdue,
          priority: row.priority as TaskPriorityValue,
          statusName: row.statusColumn?.name ?? null,
          statusColor: row.statusColumn?.colorHex ?? null,
          assigneeIds: row.assignees.map((a) => a.userId),
        }
      : null;

    const href = SUPPORT.has(n.type)
      ? p.workspaceId
        ? `/w/${p.workspaceId}/support`
        : "/inbox"
      : task
        ? `/w/${task.workspaceId}/t/${task.id}?mode=modal` // B2: notifications open the 960 modal
        : "/inbox";

    return {
      id: n.id,
      type: n.type,
      unread: !n.readAt,
      userNote: n.userNote,
      bucket: dayBucket(n.createdAt, now),
      when: whenLabel(n.createdAt, now),
      context: SUPPORT.has(n.type) ? "Support" : (p.boardName ?? row?.board.name ?? null),
      actorName: p.authorName ?? p.actorName ?? null,
      quote: p.snippet ?? p.question ?? null,
      href,
      task,
      subject: p.taskTitle ?? null,
      ticketTitle: p.ticketTitle ?? null,
      ticketStatus: p.status ?? null,
      fromStatusName: p.fromStatusName ?? null,
      toStatusName: p.toStatusName ?? null,
    };
  });

  return <InboxView items={items} members={members} />;
}
