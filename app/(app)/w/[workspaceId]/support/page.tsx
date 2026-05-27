import { db } from "@/lib/db";
import { requireWorkspaceMembership } from "@/lib/workspace-guard";
import { can } from "@/lib/permissions";
import { SupportWorkspace } from "@/components/support/support-workspace";

// Internal helpdesk per workspace. Any member can report; admins (task.update) handle.
export default async function SupportPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const ctx = await requireWorkspaceMembership(workspaceId);

  const [tickets, members] = await Promise.all([
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
            createdAt: true,
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

  return (
    <SupportWorkspace
      workspaceId={workspaceId}
      currentUserId={ctx.userId}
      canManage={can(ctx.role, "task.update")}
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
        reporter: {
          id: t.reporter.id,
          name: t.reporter.name,
          email: t.reporter.email,
          avatarUrl: t.reporter.avatarUrl,
        },
        assignee: t.assignee
          ? {
              id: t.assignee.id,
              name: t.assignee.name,
              email: t.assignee.email,
              avatarUrl: t.assignee.avatarUrl,
            }
          : null,
        attachments: t.attachments.map((a) => ({
          id: a.id,
          filename: a.filename,
          mimeType: a.mimeType,
          sizeBytes: a.sizeBytes,
          storageKey: a.storageKey,
          uploaderId: a.uploaderId,
        })),
      }))}
      members={members.map((m) => m.user)}
    />
  );
}
