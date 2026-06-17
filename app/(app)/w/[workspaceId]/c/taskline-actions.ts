"use server";

// F12-K73 v2: dedykowane server actions dla nowej wersji Task Line.
// Stara wersja używała saveCanvasSnapshotAction (whole-canvas snapshot z
// pozycjami x/y) — overkill dla flow gdzie pozycja = po prostu kolejność
// w sekwencji. Tu mamy 3 lekkie operacje:
//
//   appendTaskToFlowAction  — drop z sidebar'a → dodaje ProcessNode na końcu (lub w miejscu)
//   reorderTaskLineAction   — dnd-kit reorder → bulk update x'ów
//   removeFromFlowAction    — kliknięcie X na kafelku → DELETE node
//
// setFlowMarkAction żyje w c/actions.ts (wspólne z whiteboard'em).
//
// Konwencja x:
//   - x = sort key (Float). Pierwszy kafelek x≈0, kolejne większe.
//   - Append: max(x) + 1000.
//   - Insert między: midpoint (jak rowOrder w Task).
//   Dzięki temu reorder = update 1 wiersza, nie całej listy.

import { z } from "zod";
import { db } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import { requireWorkspaceAction } from "@/lib/workspace-guard";
import { writeAudit } from "@/lib/audit";

// ─────────── Helper: load + assert taskline canvas ────────────────────────

async function loadTaskLineCanvas(canvasId: string) {
  const canvas = await db.processCanvas.findUnique({
    where: { id: canvasId },
    select: { id: true, workspaceId: true, deletedAt: true, kind: true },
  });
  if (!canvas || canvas.deletedAt) return null;
  if (canvas.kind !== "taskline") return null;
  return canvas;
}

// ─────────── appendTaskToFlowAction ───────────────────────────────────────

const appendSchema = z.object({
  canvasId: z.string().min(1),
  taskId: z.string().min(1),
  // Opcjonalne — gdy podane, wstawiamy na danej pozycji (insert między
  // sąsiadami). Bez tego = append na koniec.
  insertAfterIndex: z.number().int().min(-1).optional(),
});

export type AppendTaskResult =
  | { ok: true; nodeId: string; x: number }
  | { ok: false; error: string };

export async function appendTaskToFlowAction(
  input: z.infer<typeof appendSchema>,
): Promise<AppendTaskResult> {
  const parsed = appendSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Bad input" };
  }

  const canvas = await loadTaskLineCanvas(parsed.data.canvasId);
  if (!canvas) return { ok: false, error: "Canvas nie istnieje." };

  const ctx = await requireWorkspaceAction(canvas.workspaceId, "canvas.edit");

  // Sprawdź czy task w ogóle istnieje w tym samym workspace'ie + dociągnij meta.
  const task = await db.task.findFirst({
    where: {
      id: parsed.data.taskId,
      workspaceId: canvas.workspaceId,
      deletedAt: null,
    },
    select: {
      id: true,
      title: true,
      statusColumn: { select: { name: true, colorHex: true } },
    },
  });
  if (!task) return { ok: false, error: "Zadanie nie istnieje." };

  // Dedup — jeden task = jeden kafelek w line.
  const existing = await db.processNode.findFirst({
    where: {
      canvasId: canvas.id,
      shape: "TASK_REF",
      dataJson: { path: ["taskId"], equals: parsed.data.taskId },
    },
    select: { id: true },
  });
  if (existing) {
    return { ok: false, error: "To zadanie jest już na linii." };
  }

  // Wylicz x (sort key).
  const allNodes = await db.processNode.findMany({
    where: { canvasId: canvas.id, shape: "TASK_REF" },
    select: { id: true, x: true },
    orderBy: { x: "asc" },
  });

  let newX: number;
  if (allNodes.length === 0) {
    newX = 0;
  } else if (
    parsed.data.insertAfterIndex === undefined ||
    parsed.data.insertAfterIndex >= allNodes.length - 1
  ) {
    // Append na koniec.
    newX = allNodes[allNodes.length - 1].x + 1000;
  } else if (parsed.data.insertAfterIndex < 0) {
    // Wstaw na początek.
    newX = allNodes[0].x - 1000;
  } else {
    // Midpoint między sąsiadami.
    const a = allNodes[parsed.data.insertAfterIndex].x;
    const b = allNodes[parsed.data.insertAfterIndex + 1].x;
    newX = (a + b) / 2;
  }

  const meta: Record<string, unknown> = {
    taskId: task.id,
    taskTitle: task.title,
    statusName: task.statusColumn?.name ?? null,
    statusColor: task.statusColumn?.colorHex ?? null,
  };

  const node = await db.processNode.create({
    data: {
      canvasId: canvas.id,
      shape: "TASK_REF",
      label: null,
      x: newX,
      y: 0,
      width: 240,
      height: 90,
      colorHex: "#FFFFFF",
      dataJson: meta as Prisma.InputJsonValue,
    },
    select: { id: true, x: true },
  });

  await writeAudit({
    workspaceId: canvas.workspaceId,
    objectType: "ProcessNode",
    objectId: node.id,
    actorId: ctx.userId,
    action: "taskline.append",
    diff: { taskId: task.id, x: newX },
  });

  return { ok: true, nodeId: node.id, x: node.x };
}

// ─────────── reorderTaskLineAction ────────────────────────────────────────
// Bulk update — UI po drop'ie wysyła nową listę node id'ków w nowej
// kolejności. Renumberujemy x'y co 1000.

const reorderSchema = z.object({
  canvasId: z.string().min(1),
  orderedNodeIds: z.array(z.string().min(1)).min(1).max(500),
});

export type ReorderResult = { ok: true } | { ok: false; error: string };

export async function reorderTaskLineAction(
  input: z.infer<typeof reorderSchema>,
): Promise<ReorderResult> {
  const parsed = reorderSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Bad input" };
  }

  const canvas = await loadTaskLineCanvas(parsed.data.canvasId);
  if (!canvas) return { ok: false, error: "Canvas nie istnieje." };

  const ctx = await requireWorkspaceAction(canvas.workspaceId, "canvas.edit");

  // Walidacja: wszystkie node id'ki muszą należeć do tego canvasu.
  const existing = await db.processNode.findMany({
    where: {
      canvasId: canvas.id,
      id: { in: parsed.data.orderedNodeIds },
      shape: "TASK_REF",
    },
    select: { id: true },
  });
  if (existing.length !== parsed.data.orderedNodeIds.length) {
    return { ok: false, error: "Niektóre kafelki nie istnieją." };
  }

  // Update każdy node z nowym x = index * 1000. Sekwencja ucinów — Prisma
  // nie ma native bulk update z różnymi values per row poza raw SQL.
  await db.$transaction(
    parsed.data.orderedNodeIds.map((id, i) =>
      db.processNode.update({
        where: { id },
        data: { x: i * 1000 },
      }),
    ),
  );

  await writeAudit({
    workspaceId: canvas.workspaceId,
    objectType: "ProcessCanvas",
    objectId: canvas.id,
    actorId: ctx.userId,
    action: "taskline.reorder",
    diff: { count: parsed.data.orderedNodeIds.length },
  });

  return { ok: true };
}

// ─────────── removeFromFlowAction ─────────────────────────────────────────

const removeSchema = z.object({
  nodeId: z.string().min(1),
});

export type RemoveResult = { ok: true } | { ok: false; error: string };

export async function removeFromFlowAction(
  input: z.infer<typeof removeSchema>,
): Promise<RemoveResult> {
  const parsed = removeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Bad input" };
  }

  const node = await db.processNode.findUnique({
    where: { id: parsed.data.nodeId },
    select: {
      id: true,
      canvasId: true,
      shape: true,
      canvas: { select: { workspaceId: true, kind: true, deletedAt: true } },
    },
  });
  if (!node || node.canvas.deletedAt || node.canvas.kind !== "taskline") {
    return { ok: false, error: "Node nie istnieje." };
  }

  const ctx = await requireWorkspaceAction(node.canvas.workspaceId, "canvas.edit");

  await db.processNode.delete({ where: { id: node.id } });

  await writeAudit({
    workspaceId: node.canvas.workspaceId,
    objectType: "ProcessNode",
    objectId: node.id,
    actorId: ctx.userId,
    action: "taskline.remove",
    diff: {},
  });

  return { ok: true };
}
