"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import { requireWorkspaceAction } from "@/lib/workspace-guard";
import { writeAudit } from "@/lib/audit";
import {
  assignTaskToMilestoneSchema,
  createMilestoneSchema,
  deleteMilestoneSchema,
  updateMilestoneSchema,
} from "@/lib/schemas/milestone";

type CreateFieldErrors = {
  title?: string;
  startAt?: string;
  stopAt?: string;
  assigneeId?: string;
};

export type CreateMilestoneState =
  | { ok: true; milestoneId: string }
  | { ok: false; error?: string; fieldErrors?: CreateFieldErrors }
  | null;

export type UpdateMilestoneState =
  | { ok: true; milestoneId: string }
  | { ok: false; error?: string; fieldErrors?: CreateFieldErrors }
  | null;

function revalidate(workspaceId: string, boardId: string) {
  revalidatePath(`/w/${workspaceId}/b/${boardId}/roadmap`);
  revalidatePath(`/w/${workspaceId}/b/${boardId}/table`);
  revalidatePath(`/w/${workspaceId}/b/${boardId}/kanban`);
}

export async function createMilestoneAction(
  _prev: CreateMilestoneState,
  formData: FormData,
): Promise<CreateMilestoneState> {
  const parsed = createMilestoneSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    boardId: formData.get("boardId"),
    title: formData.get("title"),
    descriptionJson: formData.get("descriptionJson"),
    assigneeId: formData.get("assigneeId"),
    startAt: formData.get("startAt"),
    stopAt: formData.get("stopAt"),
  });
  if (!parsed.success) {
    const fe: CreateFieldErrors = {};
    for (const issue of parsed.error.issues) {
      const k = issue.path[0];
      if (k === "title") fe.title = issue.message;
      else if (k === "startAt") fe.startAt = issue.message;
      else if (k === "stopAt") fe.stopAt = issue.message;
      else if (k === "assigneeId") fe.assigneeId = issue.message;
    }
    return { ok: false, fieldErrors: fe };
  }

  const ctx = await requireWorkspaceAction(parsed.data.workspaceId, "milestone.create");

  const board = await db.board.findFirst({
    where: { id: parsed.data.boardId, workspaceId: parsed.data.workspaceId, deletedAt: null },
  });
  if (!board) return { ok: false, error: "Tablica nie istnieje." };

  // Assignee must be a workspace member.
  if (parsed.data.assigneeId) {
    const member = await db.workspaceMembership.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: parsed.data.workspaceId,
          userId: parsed.data.assigneeId,
        },
      },
    });
    if (!member) return { ok: false, fieldErrors: { assigneeId: "Nie jest członkiem." } };
  }

  const last = await db.milestone.findFirst({
    where: { boardId: parsed.data.boardId, deletedAt: null },
    orderBy: { orderIndex: "desc" },
  });

  const milestone = await db.milestone.create({
    data: {
      workspaceId: parsed.data.workspaceId,
      boardId: parsed.data.boardId,
      creatorId: ctx.userId,
      assigneeId: parsed.data.assigneeId || null,
      title: parsed.data.title,
      descriptionJson: parsed.data.descriptionJson
        ? (parsed.data.descriptionJson as Prisma.InputJsonValue)
        : Prisma.DbNull,
      startAt: new Date(parsed.data.startAt),
      stopAt: new Date(parsed.data.stopAt),
      orderIndex: (last?.orderIndex ?? -1) + 1,
    },
  });

  await writeAudit({
    workspaceId: milestone.workspaceId,
    objectType: "Milestone",
    objectId: milestone.id,
    actorId: ctx.userId,
    action: "milestone.created",
    diff: { title: milestone.title },
  });

  revalidate(milestone.workspaceId, milestone.boardId);
  return { ok: true, milestoneId: milestone.id };
}

export async function updateMilestoneAction(
  _prev: UpdateMilestoneState,
  formData: FormData,
): Promise<UpdateMilestoneState> {
  const parsed = updateMilestoneSchema.safeParse({
    id: formData.get("id"),
    workspaceId: formData.get("workspaceId"),
    boardId: formData.get("boardId"),
    title: formData.get("title"),
    descriptionJson: formData.get("descriptionJson"),
    assigneeId: formData.get("assigneeId"),
    startAt: formData.get("startAt"),
    stopAt: formData.get("stopAt"),
  });
  if (!parsed.success) {
    const fe: CreateFieldErrors = {};
    for (const issue of parsed.error.issues) {
      const k = issue.path[0];
      if (k === "title") fe.title = issue.message;
      else if (k === "startAt") fe.startAt = issue.message;
      else if (k === "stopAt") fe.stopAt = issue.message;
      else if (k === "assigneeId") fe.assigneeId = issue.message;
    }
    return { ok: false, fieldErrors: fe };
  }

  const existing = await db.milestone.findUnique({ where: { id: parsed.data.id } });
  if (!existing || existing.deletedAt) return { ok: false, error: "Milestone nie istnieje." };

  const ctx = await requireWorkspaceAction(existing.workspaceId, "milestone.update");

  await db.milestone.update({
    where: { id: parsed.data.id },
    data: {
      title: parsed.data.title,
      descriptionJson: parsed.data.descriptionJson
        ? (parsed.data.descriptionJson as Prisma.InputJsonValue)
        : Prisma.DbNull,
      assigneeId: parsed.data.assigneeId || null,
      startAt: new Date(parsed.data.startAt),
      stopAt: new Date(parsed.data.stopAt),
    },
  });

  await writeAudit({
    workspaceId: existing.workspaceId,
    objectType: "Milestone",
    objectId: existing.id,
    actorId: ctx.userId,
    action: "milestone.updated",
    diff: { title: parsed.data.title },
  });

  revalidate(existing.workspaceId, existing.boardId);
  return { ok: true, milestoneId: existing.id };
}

export async function deleteMilestoneAction(formData: FormData) {
  const parsed = deleteMilestoneSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return;

  const existing = await db.milestone.findUnique({ where: { id: parsed.data.id } });
  if (!existing || existing.deletedAt) return;

  const ctx = await requireWorkspaceAction(existing.workspaceId, "milestone.delete");

  // Soft-delete keeps row for audit; detach tasks explicitly since Prisma's
  // onDelete: SetNull only fires on hard delete.
  await db.$transaction([
    db.task.updateMany({
      where: { milestoneId: existing.id },
      data: { milestoneId: null },
    }),
    db.milestone.update({
      where: { id: existing.id },
      data: { deletedAt: new Date() },
    }),
  ]);

  await writeAudit({
    workspaceId: existing.workspaceId,
    objectType: "Milestone",
    objectId: existing.id,
    actorId: ctx.userId,
    action: "milestone.deleted",
    diff: { title: existing.title },
  });

  revalidate(existing.workspaceId, existing.boardId);
}

export async function assignTaskToMilestoneAction(formData: FormData) {
  const parsed = assignTaskToMilestoneSchema.safeParse({
    taskId: formData.get("taskId"),
    milestoneId: formData.get("milestoneId"),
  });
  if (!parsed.success) return;

  const task = await db.task.findUnique({ where: { id: parsed.data.taskId } });
  if (!task || task.deletedAt) return;

  const ctx = await requireWorkspaceAction(task.workspaceId, "task.update");

  let targetMilestoneId: string | null = null;
  if (parsed.data.milestoneId) {
    const m = await db.milestone.findUnique({ where: { id: parsed.data.milestoneId } });
    if (!m || m.deletedAt) return;
    // Milestone must live in the task's workspace + board.
    if (m.workspaceId !== task.workspaceId || m.boardId !== task.boardId) return;
    targetMilestoneId = m.id;
  }

  const updated = await db.task.update({
    where: { id: task.id },
    data: { milestoneId: targetMilestoneId },
  });

  await writeAudit({
    workspaceId: task.workspaceId,
    objectType: "Task",
    objectId: task.id,
    actorId: ctx.userId,
    action: targetMilestoneId ? "task.milestoneAssigned" : "task.milestoneCleared",
    diff: { milestoneId: targetMilestoneId },
  });

  revalidatePath(`/w/${task.workspaceId}/t/${task.id}`);
  // Layout revalidate covers the intercepted modal route (@modal/(.)t/[taskId])
  // — without it the milestone select snaps back to its prior value.
  revalidatePath(`/w/[workspaceId]/b/[boardId]`, "layout");
  revalidate(updated.workspaceId, updated.boardId);
}

// Cross-board roadmap aggregation. Connects an aggregator-board milestone
// (parent) to a sub-board milestone (child). Same workspace only.
// Requirements enforced here:
//   - both milestones in the same workspace
//   - parent's board has isAggregator = true
//   - parent ≠ child (a milestone can't aggregate itself)
//   - distinct boards (otherwise it's not really cross-board)
// Idempotent: re-creating an existing link is a no-op (unique constraint).
export async function linkMilestoneAction(formData: FormData) {
  const parentId = String(formData.get("parentId") ?? "");
  const childId = String(formData.get("childId") ?? "");
  if (!parentId || !childId || parentId === childId) {
    return { ok: false as const, error: "Niepoprawne ID milestonów." };
  }

  const [parent, child] = await Promise.all([
    db.milestone.findUnique({
      where: { id: parentId },
      include: { board: { select: { isAggregator: true, workspaceId: true } } },
    }),
    db.milestone.findUnique({
      where: { id: childId },
      include: { board: { select: { workspaceId: true } } },
    }),
  ]);
  if (!parent || parent.deletedAt) return { ok: false as const, error: "Brak parent milestone." };
  if (!child || child.deletedAt) return { ok: false as const, error: "Brak child milestone." };
  if (parent.workspaceId !== child.workspaceId) {
    return { ok: false as const, error: "Milestony z innych workspace'ów." };
  }
  if (parent.boardId === child.boardId) {
    return { ok: false as const, error: "Wybierz milestone z innej tablicy." };
  }
  if (!parent.board.isAggregator) {
    return { ok: false as const, error: "Włącz 'Tablica zbiorcza' przed linkowaniem." };
  }

  const ctx = await requireWorkspaceAction(parent.workspaceId, "milestone.update");

  try {
    await db.milestoneLink.create({
      data: { parentId: parent.id, childId: child.id },
    });
  } catch (e) {
    // Unique violation on (parentId, childId) — link already exists. Treat as
    // success since the desired end state is identical.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: true as const };
    }
    throw e;
  }

  await writeAudit({
    workspaceId: parent.workspaceId,
    objectType: "Milestone",
    objectId: parent.id,
    actorId: ctx.userId,
    action: "milestone.linked",
    diff: { childId: child.id, childBoardId: child.boardId },
  });

  revalidate(parent.workspaceId, parent.boardId);
  revalidate(child.workspaceId, child.boardId);
  return { ok: true as const };
}

export async function unlinkMilestoneAction(formData: FormData) {
  const parentId = String(formData.get("parentId") ?? "");
  const childId = String(formData.get("childId") ?? "");
  if (!parentId || !childId) return { ok: false as const, error: "Brak ID." };

  const parent = await db.milestone.findUnique({
    where: { id: parentId },
    select: { id: true, workspaceId: true, boardId: true },
  });
  if (!parent) return { ok: false as const, error: "Brak parent milestone." };

  const ctx = await requireWorkspaceAction(parent.workspaceId, "milestone.update");

  await db.milestoneLink.deleteMany({
    where: { parentId, childId },
  });

  await writeAudit({
    workspaceId: parent.workspaceId,
    objectType: "Milestone",
    objectId: parent.id,
    actorId: ctx.userId,
    action: "milestone.unlinked",
    diff: { childId },
  });

  // Find child's board for revalidate; if it was hard-deleted skip silently.
  const child = await db.milestone.findUnique({
    where: { id: childId },
    select: { workspaceId: true, boardId: true },
  });
  revalidate(parent.workspaceId, parent.boardId);
  if (child) revalidate(child.workspaceId, child.boardId);
  return { ok: true as const };
}
