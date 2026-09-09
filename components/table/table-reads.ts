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
  _count: { select: { comments: { where: { deletedAt: null } } } },
  // Tresc podzadan i powiazan idzie do rozwijanego wiersza Listy; ladunek rosnie
  // proporcjonalnie do tego, co zadanie naprawde ma (zwykle 0 pozycji).
  subtasks: { select: { id: true, title: true, completed: true }, orderBy: { order: "asc" } },
  linksOut: { where: { target: { deletedAt: null } }, select: { target: { select: { id: true, displayId: true, title: true, boardId: true } } } },
  linksIn: { where: { source: { deletedAt: null } }, select: { source: { select: { id: true, displayId: true, title: true, boardId: true } } } },
} satisfies Prisma.TaskInclude;

type TaskRow = Prisma.TaskGetPayload<{ include: typeof taskInclude }>;

export function toTableTask(t: TaskRow, hasDescription: boolean): BoardTableTask {
  // TaskLink jest symetryczny w UI — obie strony trafiaja na jedna liste,
  // bez duplikatu gdy dwa zadania sa polaczone w obie strony.
  const linked = [...t.linksOut.map((l) => l.target), ...t.linksIn.map((l) => l.source)]
    .filter((x, i, all) => all.findIndex((y) => y.id === x.id) === i)
    .map((x) => ({ id: x.id, displayId: x.displayId, title: x.title, otherBoard: x.boardId !== t.boardId }));
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
    linkedCount: linked.length,
    parentId: t.parentId,
    subtasks: t.subtasks.map((s) => ({ id: s.id, title: s.title, completed: s.completed })),
    linked,
  };
}
