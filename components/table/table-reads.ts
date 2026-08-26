import type { Prisma } from "@/lib/generated/prisma/client";
import type { BoardTableTask } from "@/components/table/types";

// Shared Prisma include + row mapper for the Lista (default /table route and
// custom TABLE views). Read-only; mutations stay in the existing actions.
export const taskInclude = {
  assignees: { include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } } },
  tags: { include: { tag: true } },
  customValues: true,
  milestone: { select: { id: true, title: true } },
  attachments: {
    where: { deletedAt: null },
    select: { id: true, filename: true, mimeType: true, sizeBytes: true },
    orderBy: { createdAt: "desc" },
  },
  _count: { select: { comments: { where: { deletedAt: null } }, linksOut: true, linksIn: true } },
  subtasks: { select: { completed: true } },
} satisfies Prisma.TaskInclude;

type TaskRow = Prisma.TaskGetPayload<{ include: typeof taskInclude }>;

export function toTableTask(t: TaskRow, hasDescription: boolean): BoardTableTask {
  return {
    id: t.id,
    displayId: t.displayId,
    title: t.title,
    statusColumnId: t.statusColumnId,
    priority: t.priority,
    startAt: t.startAt ? t.startAt.toISOString() : null,
    stopAt: t.stopAt ? t.stopAt.toISOString() : null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    assignees: t.assignees.map((a) => ({ id: a.userId, name: a.user.name, email: a.user.email, avatarUrl: a.user.avatarUrl })),
    tags: t.tags.map((tt) => ({ id: tt.tag.id, name: tt.tag.name, colorHex: tt.tag.colorHex })),
    customValues: Object.fromEntries(t.customValues.map((v) => [v.columnId, v.valueText ?? ""])),
    attachments: t.attachments.map((a) => ({ id: a.id, filename: a.filename, mimeType: a.mimeType, sizeBytes: a.sizeBytes })),
    milestone: t.milestone ? { id: t.milestone.id, title: t.milestone.title } : null,
    hasDescription,
    commentCount: t._count.comments,
    subtaskCount: t.subtasks.length,
    subtaskDoneCount: t.subtasks.filter((s) => s.completed).length,
    // TaskLink is symmetric in the UI — count both directions.
    linkedCount: t._count.linksOut + t._count.linksIn,
  };
}
