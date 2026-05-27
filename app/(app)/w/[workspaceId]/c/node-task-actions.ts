"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireWorkspaceAction } from "@/lib/workspace-guard";
import { writeAudit } from "@/lib/audit";
import {
  createAndLinkTaskFromNodeSchema,
  linkTaskToNodeSchema,
  unlinkTaskFromNodeSchema,
} from "@/lib/schemas/node-task-link";

export type LinkResult =
  | { ok: true }
  | { ok: false; error: string };

export type CreateAndLinkResult =
  | { ok: true; taskId: string }
  | { ok: false; error: string };

async function loadNodeContext(nodeId: string) {
  return db.processNode.findUnique({
    where: { id: nodeId },
    include: {
      canvas: { select: { id: true, workspaceId: true, deletedAt: true } },
    },
  });
}

export async function linkTaskToNodeAction(input: {
  nodeId: string;
  taskId: string;
}): Promise<LinkResult> {
  const parsed = linkTaskToNodeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Nieprawidłowe dane." };

  const node = await loadNodeContext(parsed.data.nodeId);
  if (!node || node.canvas.deletedAt) return { ok: false, error: "Węzeł nie istnieje." };

  const ctx = await requireWorkspaceAction(node.canvas.workspaceId, "canvas.edit");

  // Task must live in the same workspace as the canvas.
  const task = await db.task.findUnique({
    where: { id: parsed.data.taskId },
    select: { id: true, workspaceId: true, deletedAt: true, title: true },
  });
  if (!task || task.deletedAt || task.workspaceId !== node.canvas.workspaceId) {
    return { ok: false, error: "Zadanie nie istnieje w tej przestrzeni." };
  }

  // Idempotent upsert keyed on the composite PK.
  await db.processNodeTaskLink.upsert({
    where: { nodeId_taskId: { nodeId: node.id, taskId: task.id } },
    update: {},
    create: { nodeId: node.id, taskId: task.id },
  });

  await writeAudit({
    workspaceId: node.canvas.workspaceId,
    objectType: "ProcessCanvas",
    objectId: node.canvas.id,
    actorId: ctx.userId,
    action: "canvas.taskLinked",
    diff: { nodeId: node.id, taskId: task.id, taskTitle: task.title },
  });

  revalidatePath(`/w/${node.canvas.workspaceId}/c/${node.canvas.id}`);
  return { ok: true };
}

export async function unlinkTaskFromNodeAction(input: {
  nodeId: string;
  taskId: string;
}): Promise<LinkResult> {
  const parsed = unlinkTaskFromNodeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Nieprawidłowe dane." };

  const node = await loadNodeContext(parsed.data.nodeId);
  if (!node || node.canvas.deletedAt) return { ok: false, error: "Węzeł nie istnieje." };

  const ctx = await requireWorkspaceAction(node.canvas.workspaceId, "canvas.edit");

  // deleteMany so a missing row is a no-op rather than a throw.
  const deleted = await db.processNodeTaskLink.deleteMany({
    where: { nodeId: parsed.data.nodeId, taskId: parsed.data.taskId },
  });
  if (deleted.count === 0) return { ok: true };

  await writeAudit({
    workspaceId: node.canvas.workspaceId,
    objectType: "ProcessCanvas",
    objectId: node.canvas.id,
    actorId: ctx.userId,
    action: "canvas.taskUnlinked",
    diff: { nodeId: parsed.data.nodeId, taskId: parsed.data.taskId },
  });

  revalidatePath(`/w/${node.canvas.workspaceId}/c/${node.canvas.id}`);
  return { ok: true };
}

// Creates a Task in the given board and links it to the node in one shot.
// Title defaults to the node's label on the client.
export async function createAndLinkTaskFromNodeAction(input: {
  nodeId: string;
  boardId: string;
  title: string;
}): Promise<CreateAndLinkResult> {
  const parsed = createAndLinkTaskFromNodeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Nieprawidłowe dane." };
  }

  const node = await loadNodeContext(parsed.data.nodeId);
  if (!node || node.canvas.deletedAt) return { ok: false, error: "Węzeł nie istnieje." };

  const ctx = await requireWorkspaceAction(node.canvas.workspaceId, "task.create");

  const board = await db.board.findFirst({
    where: {
      id: parsed.data.boardId,
      workspaceId: node.canvas.workspaceId,
      deletedAt: null,
    },
    include: { statusColumns: { orderBy: { order: "asc" }, take: 1 } },
  });
  if (!board) return { ok: false, error: "Tablica nie istnieje w tej przestrzeni." };

  const lastTask = await db.task.findFirst({
    where: { boardId: board.id, deletedAt: null },
    orderBy: { rowOrder: "desc" },
    select: { rowOrder: true },
  });

  const task = await db.task.create({
    data: {
      workspaceId: node.canvas.workspaceId,
      boardId: board.id,
      statusColumnId: board.statusColumns[0]?.id,
      creatorId: ctx.userId,
      title: parsed.data.title,
      rowOrder: (lastTask?.rowOrder ?? 0) + 1,
    },
  });

  await db.processNodeTaskLink.create({
    data: { nodeId: node.id, taskId: task.id },
  });

  await writeAudit({
    workspaceId: node.canvas.workspaceId,
    objectType: "Task",
    objectId: task.id,
    actorId: ctx.userId,
    action: "task.createdFromCanvas",
    diff: { title: task.title, nodeId: node.id, canvasId: node.canvas.id },
  });

  revalidatePath(`/w/${node.canvas.workspaceId}/c/${node.canvas.id}`);
  return { ok: true, taskId: task.id };
}
