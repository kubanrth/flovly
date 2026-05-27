import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { unreadPl } from "@/lib/pluralize";
import { AppShell } from "@/components/layout/app-shell";
import {
  InboxHotkeyList,
  type InboxNotification,
} from "@/components/inbox/inbox-hotkey-wrapper";

interface MentionPayload {
  commentId?: string;
  taskId?: string;
  workspaceId?: string;
  authorId?: string;
  authorName?: string;
  taskTitle?: string;
  snippet?: string;
}

interface PollCreatedPayload {
  workspaceId?: string;
  taskId?: string;
  taskTitle?: string;
  boardName?: string;
  question?: string;
  authorName?: string | null;
}

// Emitted by toggleAssigneeAction when someone assigns the current user.
interface TaskAssignedPayload {
  workspaceId?: string;
  taskId?: string;
  taskTitle?: string;
  boardId?: string;
  boardName?: string | null;
  actorId?: string;
  actorName?: string | null;
}

// Emitted via notifyBoardEvent from createTaskAction and patchTaskAction; goes
// to every workspace member except the actor.
interface TaskBoardEventPayload {
  workspaceId?: string;
  taskId?: string;
  taskTitle?: string;
  boardId?: string;
  boardName?: string | null;
  actorId?: string;
  actorName?: string | null;
  // task.status.changed only.
  fromStatusName?: string | null;
  toStatusName?: string | null;
}

// Emitted by updateSupportTicketAction when admin marks reporter's ticket RESOLVED/CLOSED.
interface SupportResolvedPayload {
  workspaceId?: string;
  ticketId?: string;
  ticketTitle?: string;
  status?: string;
  actorId?: string;
  actorName?: string | null;
}

async function loadNotifications(userId: string) {
  return db.notification.findMany({
    where: { userId },
    orderBy: [{ readAt: { sort: "asc", nulls: "first" } }, { createdAt: "desc" }],
    take: 200,
  });
}

export default async function InboxPage() {
  const session = await auth();
  const userId = session!.user.id;

  // One membership query feeds both the notification workspace filter and the
  // assign-hotkey roster — full roster contains active workspaces, so derive
  // both sets in memory.
  const memberships = await db.workspaceMembership.findMany({
    where: {
      workspace: {
        deletedAt: null,
        memberships: { some: { userId } },
      },
    },
    include: {
      user: {
        select: { id: true, name: true, email: true, avatarUrl: true },
      },
    },
  });
  const activeWorkspaceIds = new Set(
    memberships
      .filter((m) => m.userId === userId)
      .map((m) => m.workspaceId),
  );

  const allNotifications = await loadNotifications(userId);
  const notifications = allNotifications.filter((n) => {
    const ws = (n.payload as { workspaceId?: string } | null)?.workspaceId;
    // Keep notifications without workspace context or that point to a live
    // workspace the user is a member of; drop everything else.
    return !ws || activeWorkspaceIds.has(ws);
  });

  // Pre-fetch assignees so the hotkey popup can highlight already-assigned people.
  const taskIds = Array.from(
    new Set(
      notifications
        .map((n) => {
          const p = (n.payload ?? {}) as MentionPayload & PollCreatedPayload;
          return p.taskId;
        })
        .filter((x): x is string => !!x),
    ),
  );
  const assigneesByTask = new Map<string, string[]>();
  if (taskIds.length > 0) {
    const rows = await db.taskAssignee.findMany({
      where: { taskId: { in: taskIds } },
      select: { taskId: true, userId: true },
    });
    for (const r of rows) {
      const arr = assigneesByTask.get(r.taskId) ?? [];
      arr.push(r.userId);
      assigneesByTask.set(r.taskId, arr);
    }
  }

  // Union of every workspace member so the hotkey popup works across workspaces.
  // toggleAssigneeAction re-validates membership server-side.
  const memberMap = new Map<string, { id: string; name: string | null; email: string; avatarUrl: string | null }>();
  for (const m of memberships) {
    if (!memberMap.has(m.user.id)) memberMap.set(m.user.id, m.user);
  }
  const members = Array.from(memberMap.values()).sort((a, b) =>
    (a.name ?? a.email).localeCompare(b.name ?? b.email),
  );

  const toRow = (n: (typeof notifications)[number]): InboxNotification => {
    const payload = (n.payload ?? {}) as MentionPayload &
      PollCreatedPayload &
      TaskAssignedPayload &
      TaskBoardEventPayload &
      SupportResolvedPayload;
    return {
      id: n.id,
      type: n.type,
      createdAt: n.createdAt.toISOString(),
      unread: !n.readAt,
      userNote: n.userNote,
      payload: {
        workspaceId: payload.workspaceId,
        taskId: payload.taskId,
        taskTitle: payload.taskTitle,
        authorName: payload.authorName,
        snippet: payload.snippet,
        boardName: payload.boardName ?? undefined,
        question: payload.question,
        actorName: payload.actorName,
        ticketId: payload.ticketId,
        ticketTitle: payload.ticketTitle,
        status: payload.status,
        fromStatusName: payload.fromStatusName ?? undefined,
        toStatusName: payload.toStatusName ?? undefined,
      },
      assigneeIds: payload.taskId
        ? assigneesByTask.get(payload.taskId) ?? []
        : null,
    };
  };

  const unread = notifications.filter((n) => !n.readAt).map(toRow);
  const read = notifications.filter((n) => n.readAt).map(toRow);

  return (
    <AppShell>
      <div className="flex flex-col gap-10">
        <div className="flex items-end justify-between gap-4">
          <div className="flex flex-col gap-2">
            <span className="eyebrow">Powiadomienia</span>
            <h1 className="font-display text-[2.2rem] font-bold leading-[1.1] tracking-[-0.03em]">
              Inbox. <span className="text-brand-gradient">{unread.length}</span>{" "}
              {unreadPl(unread.length)}.
            </h1>
            <p className="text-[0.9rem] text-muted-foreground">
              Najedź na zadanie i wciśnij{" "}
              <kbd className="rounded-sm border border-border bg-muted px-1 text-[0.7rem]">M</kbd>{" "}
              aby szybko kogoś przypisać.
            </p>
          </div>
        </div>

        <InboxHotkeyList members={members} unread={unread} read={read} />
      </div>
    </AppShell>
  );
}
