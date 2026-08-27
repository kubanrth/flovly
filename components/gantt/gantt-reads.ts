import type { Prisma } from "@/lib/generated/prisma/client";

// Shared Prisma include + row mappers for Oś czasu (B5) — the default /gantt
// route and custom GANTT views. Read-only; the bar drag goes through the
// existing patchTaskAction.

export interface GanttTaskItem {
  id: string;
  displayId: number;
  title: string;
  startAt: string | null;
  stopAt: string | null;
  statusColor: string;
  statusName: string | null;
  milestoneId: string | null;
  /** Do filtra „kto" w pasku osi czasu i awatarów na wierszu. */
  assigneeIds: string[];
  /** TaskLink targets — drawn as dependency arrows when both ends are on screen. */
  linksTo: string[];
}

export interface GanttMilestoneItem {
  id: string;
  title: string;
  startAt: string;
  stopAt: string;
}

export const ganttTaskInclude = {
  statusColumn: { select: { name: true, colorHex: true } },
  linksOut: { select: { targetTaskId: true } },
  assignees: { select: { userId: true } },
} satisfies Prisma.TaskInclude;

type TaskRow = Prisma.TaskGetPayload<{ include: typeof ganttTaskInclude }>;

export function toGanttTask(t: TaskRow): GanttTaskItem {
  return {
    id: t.id,
    displayId: t.displayId,
    title: t.title,
    startAt: t.startAt ? t.startAt.toISOString() : null,
    stopAt: t.stopAt ? t.stopAt.toISOString() : null,
    statusColor: t.statusColumn?.colorHex ?? "#8A857D",
    statusName: t.statusColumn?.name ?? null,
    milestoneId: t.milestoneId,
    linksTo: t.linksOut.map((l) => l.targetTaskId),
    assigneeIds: t.assignees.map((a) => a.userId),
  };
}

export function toGanttMilestone(m: { id: string; title: string; startAt: Date; stopAt: Date }): GanttMilestoneItem {
  return { id: m.id, title: m.title, startAt: m.startAt.toISOString(), stopAt: m.stopAt.toISOString() };
}
