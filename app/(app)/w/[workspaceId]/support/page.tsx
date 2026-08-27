import { db } from "@/lib/db";
import { requireWorkspaceMembership } from "@/lib/workspace-guard";
import { can } from "@/lib/permissions";
import { SupportWorkspace } from "@/components/support/support-workspace";
import { dueLabel, whenLabel } from "@/components/inbox/inbox-model";
import { formatDuration } from "@/lib/format-duration";

// E9 „Support" — wewnętrzny helpdesk przestrzeni. Każdy członek zgłasza,
// admini (task.update) obsługują. Etykiety czasu liczymy tutaj, w stałej
// strefie Europe/Warsaw, żeby SSR w kontenerze na UTC nie rozjeżdżał się
// z hydracją.
export default async function SupportPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const ctx = await requireWorkspaceMembership(workspaceId);

  const [tickets, members, boards] = await Promise.all([
    db.supportTicket.findMany({
      where: { workspaceId },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: {
        reporter: { select: { id: true, name: true, email: true, avatarUrl: true } },
        assignee: { select: { id: true, name: true, email: true, avatarUrl: true } },
        attachments: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            filename: true,
            mimeType: true,
            sizeBytes: true,
            storageKey: true,
            uploaderId: true,
          },
        },
      },
    }),
    db.workspaceMembership.findMany({
      where: { workspaceId },
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
      orderBy: { joinedAt: "asc" },
    }),
    // Tablice dla „Zrób zadanie" — te same reguły widoczności co w shellu.
    db.board.findMany({
      where: {
        workspaceId,
        deletedAt: null,
        ...(ctx.role === "ADMIN"
          ? {}
          : { OR: [{ visibility: "PUBLIC" }, { memberships: { some: { userId: ctx.userId } } }] }),
      },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      select: { id: true, name: true },
    }),
  ]);

  const now = new Date();

  return (
    <SupportWorkspace
      workspaceId={workspaceId}
      currentUserId={ctx.userId}
      canManage={can(ctx.role, "task.update")}
      canCreateTask={can(ctx.role, "task.create")}
      nowMs={now.getTime()}
      tickets={tickets.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        status: t.status,
        priority: t.priority,
        dueAt: t.dueAt ? t.dueAt.toISOString() : null,
        isUrgent: t.isUrgent,
        createdAt: t.createdAt.toISOString(),
        resolvedAt: t.resolvedAt ? t.resolvedAt.toISOString() : null,
        reporter: t.reporter,
        assignee: t.assignee,
        attachments: t.attachments,
        listTime: whenLabel(t.createdAt, now),
        createdLabel: whenLabel(t.createdAt, now),
        dueLabel: t.dueAt ? dueLabel(t.dueAt, now) : null,
        resolvedIn: t.resolvedAt ? formatDuration(t.createdAt, t.resolvedAt) : null,
      }))}
      members={members.map((m) => m.user)}
      boards={boards}
    />
  );
}
