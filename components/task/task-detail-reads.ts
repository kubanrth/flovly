"use server";

import { db } from "@/lib/db";
import { requireWorkspaceMembership } from "@/lib/workspace-guard";

// Extra task data the redesigned card needs that lib/task-fetch.ts (read-only
// for this phase) does not return: version (conflict banner), timestamps +
// creator (footer), view membership (Widoki), time entries (Czas pracy tab).
export interface TaskMeta {
  version: number;
  createdAt: string;
  updatedAt: string;
  creatorName: string;
  views: { id: string; name: string }[];
  timeEntries: { id: string; userName: string; startedAt: string; durationSeconds: number; note: string | null }[];
}

export async function readTaskMeta(workspaceId: string, taskId: string): Promise<TaskMeta | null> {
  await requireWorkspaceMembership(workspaceId);
  const t = await db.task.findFirst({
    where: { id: taskId, workspaceId, deletedAt: null },
    select: {
      version: true, createdAt: true, updatedAt: true,
      creator: { select: { name: true, email: true } },
      taskViews: { select: { view: { select: { id: true, name: true } } } },
      timeEntries: {
        where: { deletedAt: null },
        orderBy: { startedAt: "desc" },
        take: 50,
        select: { id: true, startedAt: true, durationSeconds: true, note: true, user: { select: { name: true, email: true } } },
      },
    },
  });
  if (!t) return null;
  const label = (u: { name: string | null; email: string }) => u.name ?? u.email.split("@")[0]!;
  return {
    version: t.version,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    creatorName: label(t.creator),
    views: t.taskViews.flatMap((v) => (v.view.name ? [{ id: v.view.id, name: v.view.name }] : [])),
    timeEntries: t.timeEntries.map((e) => ({
      id: e.id, userName: label(e.user), startedAt: e.startedAt.toISOString(), durationSeconds: e.durationSeconds, note: e.note,
    })),
  };
}
