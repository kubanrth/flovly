"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import { requireWorkspaceAction } from "@/lib/workspace-guard";
import { writeAudit } from "@/lib/audit";

// Symmetric in the UI (link visible from both ends) but stored once. Source =
// the task whose detail page initiated the link.
export async function linkTasksAction(formData: FormData) {
  const sourceTaskId = String(formData.get("sourceTaskId") ?? "");
  const targetTaskId = String(formData.get("targetTaskId") ?? "");
  if (!sourceTaskId || !targetTaskId || sourceTaskId === targetTaskId) return;

  const [source, target] = await Promise.all([
    db.task.findUnique({
      where: { id: sourceTaskId },
      select: { id: true, workspaceId: true, deletedAt: true, title: true },
    }),
    db.task.findUnique({
      where: { id: targetTaskId },
      select: { id: true, workspaceId: true, deletedAt: true, title: true },
    }),
  ]);
  if (!source || source.deletedAt) return;
  if (!target || target.deletedAt) return;
  if (source.workspaceId !== target.workspaceId) return;

  const ctx = await requireWorkspaceAction(source.workspaceId, "task.update");

  // Reject the mirror pair too — if (A→B) exists, linking (B→A) would create
  // a second row representing the same relationship. The unique constraint
  // covers (source, target) only, so we de-dup the reverse direction here.
  const reverse = await db.taskLink.findFirst({
    where: { sourceTaskId: target.id, targetTaskId: source.id },
    select: { id: true },
  });
  if (reverse) return;

  try {
    await db.taskLink.create({
      data: {
        workspaceId: source.workspaceId,
        sourceTaskId: source.id,
        targetTaskId: target.id,
        createdById: ctx.userId,
      },
    });
  } catch (e) {
    // Same pair already linked — desired end state, swallow.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return;
    }
    throw e;
  }

  await writeAudit({
    workspaceId: source.workspaceId,
    objectType: "TaskLink",
    objectId: source.id,
    actorId: ctx.userId,
    action: "taskLink.created",
    diff: { targetTaskId: target.id },
  });

  revalidatePath(`/w/${source.workspaceId}/t/${source.id}`);
  revalidatePath(`/w/${source.workspaceId}/t/${target.id}`);
}

export async function unlinkTasksAction(formData: FormData) {
  const linkId = String(formData.get("linkId") ?? "");
  if (!linkId) return;

  const link = await db.taskLink.findUnique({
    where: { id: linkId },
    select: { id: true, workspaceId: true, sourceTaskId: true, targetTaskId: true },
  });
  if (!link) return;

  const ctx = await requireWorkspaceAction(link.workspaceId, "task.update");

  await db.taskLink.delete({ where: { id: link.id } });

  await writeAudit({
    workspaceId: link.workspaceId,
    objectType: "TaskLink",
    objectId: link.sourceTaskId,
    actorId: ctx.userId,
    action: "taskLink.deleted",
    diff: { targetTaskId: link.targetTaskId },
  });

  revalidatePath(`/w/${link.workspaceId}/t/${link.sourceTaskId}`);
  revalidatePath(`/w/${link.workspaceId}/t/${link.targetTaskId}`);
}
