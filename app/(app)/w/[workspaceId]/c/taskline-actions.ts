"use server";

// F12-K73 v3: dedykowane server actions dla Task Line — z wsparciem dla
// wielu linii per canvas + auto-positioning Start/End.
//
// Konwencja x:
//   - x = sort key (Float). Pierwszy kafelek x≈0, kolejne większe.
//   - Append: max(x w linii) + 1000 ALE jeśli linia ma End → x = End.x - 0.5
//   - Insert między: midpoint.
//   - Start zawsze = min(x w linii) - 1000 (przesuwa się sam)
//   - End zawsze = max(x w linii) + 1000 (przesuwa się sam)
//
// Konwencja lineId:
//   - Każdy ProcessNode TASK_REF ma dataJson.lineId wskazujący TaskLineRow id.
//   - Legacy nodes bez lineId są przepisywane na pierwszą row canvas'u w
//     ensureCanvasHasRow (page.tsx).
//
// Konwencja Start/End uniqueness:
//   - Per linia jest max 1 node z flowMark='start' i 1 z flowMark='end'.
//   - Gdy user oznacza B jako Start, poprzedni Start (A) traci mark.

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

// ─────────── Helper: pobiera TASK_REF nodes w linii (sort by x asc) ───────

async function getLineNodes(canvasId: string, lineId: string) {
  const all = await db.processNode.findMany({
    where: { canvasId, shape: "TASK_REF" },
    select: { id: true, x: true, dataJson: true },
    orderBy: { x: "asc" },
  });
  return all
    .filter((n) => {
      const meta =
        n.dataJson && typeof n.dataJson === "object" && !Array.isArray(n.dataJson)
          ? (n.dataJson as Record<string, unknown>)
          : {};
      return meta.lineId === lineId;
    })
    .map((n) => ({
      id: n.id,
      x: n.x,
      flowMark:
        getMeta(n.dataJson).flowMark === "start" || getMeta(n.dataJson).flowMark === "end"
          ? (getMeta(n.dataJson).flowMark as "start" | "end")
          : null,
    }));
}

function getMeta(dataJson: unknown): Record<string, unknown> {
  if (dataJson && typeof dataJson === "object" && !Array.isArray(dataJson)) {
    return dataJson as Record<string, unknown>;
  }
  return {};
}

// ─────────── appendTaskToFlowAction ───────────────────────────────────────

const appendSchema = z.object({
  canvasId: z.string().min(1),
  lineId: z.string().min(1),
  taskId: z.string().min(1),
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

  // Walidacja: linia istnieje na tym canvasie?
  const row = await db.taskLineRow.findFirst({
    where: { id: parsed.data.lineId, canvasId: canvas.id },
    select: { id: true },
  });
  if (!row) return { ok: false, error: "Linia nie istnieje." };

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

  // Dedup w obrębie CAŁEGO canvasu (jeden task = jedna linia, w max jednym miejscu).
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

  // Pobierz wszystkie node'y w tej linii + zidentyfikuj Start/End.
  const lineNodes = await getLineNodes(canvas.id, parsed.data.lineId);
  const startNode = lineNodes.find((n) => n.flowMark === "start");
  const endNode = lineNodes.find((n) => n.flowMark === "end");

  // Wylicz target x — uwzględniając anchors.
  // Body = node'y w linii bez Start i End (czyli "wnętrze").
  const body = lineNodes.filter((n) => n !== startNode && n !== endNode);

  let newX: number;
  if (body.length === 0 && !startNode && !endNode) {
    // Pusta linia — pierwszy node.
    newX = 0;
  } else {
    // Append na koniec body, potem clamp do (start, end).
    const insertAfter =
      parsed.data.insertAfterIndex !== undefined &&
      parsed.data.insertAfterIndex >= 0 &&
      parsed.data.insertAfterIndex < body.length
        ? parsed.data.insertAfterIndex
        : body.length - 1;

    let prevX: number;
    let nextX: number;
    if (body.length === 0) {
      prevX = startNode?.x ?? -1000;
      nextX = endNode?.x ?? prevX + 2000;
    } else if (insertAfter < 0) {
      prevX = startNode?.x ?? body[0].x - 1000;
      nextX = body[0].x;
    } else if (insertAfter >= body.length - 1) {
      prevX = body[body.length - 1].x;
      nextX = endNode?.x ?? prevX + 2000;
    } else {
      prevX = body[insertAfter].x;
      nextX = body[insertAfter + 1].x;
    }

    newX = (prevX + nextX) / 2;
  }

  const meta: Record<string, unknown> = {
    taskId: task.id,
    taskTitle: task.title,
    statusName: task.statusColumn?.name ?? null,
    statusColor: task.statusColumn?.colorHex ?? null,
    lineId: parsed.data.lineId,
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
    diff: { taskId: task.id, lineId: parsed.data.lineId, x: newX },
  });

  return { ok: true, nodeId: node.id, x: node.x };
}

// ─────────── reorderTaskLineAction ────────────────────────────────────────

const reorderSchema = z.object({
  canvasId: z.string().min(1),
  lineId: z.string().min(1),
  // Tylko BODY (bez Start/End) — UI nie pozwala przesuwać kotwic. Start
  // zawsze będzie x=min-1000, End zawsze x=max+1000 po renumberowaniu.
  orderedBodyNodeIds: z.array(z.string().min(1)).max(500),
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

  const lineNodes = await getLineNodes(canvas.id, parsed.data.lineId);
  const startNode = lineNodes.find((n) => n.flowMark === "start");
  const endNode = lineNodes.find((n) => n.flowMark === "end");

  // Walidacja: body ids ⊆ line nodes (bez kotwic).
  const allowedIds = new Set(
    lineNodes.filter((n) => n !== startNode && n !== endNode).map((n) => n.id),
  );
  for (const id of parsed.data.orderedBodyNodeIds) {
    if (!allowedIds.has(id)) {
      return { ok: false, error: "Nieprawidłowy node w reorderze." };
    }
  }

  // Renumber: Start (jeśli jest) = 0, body i*1000 + 1000, End (jeśli jest) = ostatnie + 1000.
  const updates: Prisma.PrismaPromise<unknown>[] = [];
  if (startNode) {
    updates.push(db.processNode.update({ where: { id: startNode.id }, data: { x: 0 } }));
  }
  parsed.data.orderedBodyNodeIds.forEach((id, i) => {
    updates.push(
      db.processNode.update({ where: { id }, data: { x: (i + 1) * 1000 } }),
    );
  });
  if (endNode) {
    updates.push(
      db.processNode.update({
        where: { id: endNode.id },
        data: { x: (parsed.data.orderedBodyNodeIds.length + 1) * 1000 },
      }),
    );
  }
  await db.$transaction(updates);

  await writeAudit({
    workspaceId: canvas.workspaceId,
    objectType: "ProcessCanvas",
    objectId: canvas.id,
    actorId: ctx.userId,
    action: "taskline.reorder",
    diff: { lineId: parsed.data.lineId, count: parsed.data.orderedBodyNodeIds.length },
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

// ─────────── setFlowMarkInLineAction (v3 — line-scoped, enforces uniqueness + repositions) ───

const setMarkSchema = z.object({
  canvasId: z.string().min(1),
  lineId: z.string().min(1),
  nodeId: z.string().min(1),
  mark: z.enum(["start", "end"]).nullable(),
});

export type SetMarkResult = { ok: true } | { ok: false; error: string };

export async function setFlowMarkInLineAction(
  input: z.infer<typeof setMarkSchema>,
): Promise<SetMarkResult> {
  const parsed = setMarkSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Bad input" };
  }

  const canvas = await loadTaskLineCanvas(parsed.data.canvasId);
  if (!canvas) return { ok: false, error: "Canvas nie istnieje." };

  const ctx = await requireWorkspaceAction(canvas.workspaceId, "canvas.edit");

  // Wszystkie node'y w linii — żeby znaleźć poprzedni Start/End i odpiąć go.
  const lineNodes = await getLineNodes(canvas.id, parsed.data.lineId);
  const targetNode = lineNodes.find((n) => n.id === parsed.data.nodeId);
  if (!targetNode) return { ok: false, error: "Node nie istnieje w tej linii." };

  // Wylicz nowe x dla target gdy mark != null:
  //   - 'start' → min(x w linii poza target) - 1000
  //   - 'end'   → max(x w linii poza target) + 1000
  // Gdy mark == null → x zostaje bez zmian.
  const others = lineNodes.filter((n) => n.id !== targetNode.id);
  let targetNewX: number | null = null;
  if (parsed.data.mark === "start" && others.length > 0) {
    targetNewX = Math.min(...others.map((n) => n.x)) - 1000;
  } else if (parsed.data.mark === "end" && others.length > 0) {
    targetNewX = Math.max(...others.map((n) => n.x)) + 1000;
  }

  // Poprzedni Start/End (różny od target) z tym samym markiem → wyzeruj jego mark.
  const previousWithSameMark = others.find((n) => n.flowMark === parsed.data.mark);

  // Pobierz świeże dataJson dla mutacji.
  const nodesToUpdate = await db.processNode.findMany({
    where: {
      id: {
        in: [targetNode.id, ...(previousWithSameMark ? [previousWithSameMark.id] : [])],
      },
    },
    select: { id: true, dataJson: true },
  });

  const updates: Prisma.PrismaPromise<unknown>[] = [];
  for (const n of nodesToUpdate) {
    const meta = getMeta(n.dataJson);
    if (n.id === targetNode.id) {
      // Target — set new mark.
      if (parsed.data.mark === null) {
        delete meta.flowMark;
      } else {
        meta.flowMark = parsed.data.mark;
      }
      updates.push(
        db.processNode.update({
          where: { id: n.id },
          data: {
            dataJson:
              Object.keys(meta).length === 0
                ? Prisma.DbNull
                : (meta as Prisma.InputJsonValue),
            ...(targetNewX !== null ? { x: targetNewX } : {}),
          },
        }),
      );
    } else {
      // Previous holder — clear its mark.
      delete meta.flowMark;
      updates.push(
        db.processNode.update({
          where: { id: n.id },
          data: {
            dataJson:
              Object.keys(meta).length === 0
                ? Prisma.DbNull
                : (meta as Prisma.InputJsonValue),
          },
        }),
      );
    }
  }
  await db.$transaction(updates);

  await writeAudit({
    workspaceId: canvas.workspaceId,
    objectType: "ProcessNode",
    objectId: targetNode.id,
    actorId: ctx.userId,
    action: "taskline.flowMark",
    diff: { lineId: parsed.data.lineId, mark: parsed.data.mark },
  });

  return { ok: true };
}

// ─────────── createLineAction ─────────────────────────────────────────────

const createLineSchema = z.object({
  canvasId: z.string().min(1),
  name: z.string().min(1).max(80).optional(),
});

export type CreateLineResult =
  | { ok: true; lineId: string; name: string; order: number }
  | { ok: false; error: string };

export async function createLineAction(
  input: z.infer<typeof createLineSchema>,
): Promise<CreateLineResult> {
  const parsed = createLineSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Bad input" };
  }

  const canvas = await loadTaskLineCanvas(parsed.data.canvasId);
  if (!canvas) return { ok: false, error: "Canvas nie istnieje." };

  const ctx = await requireWorkspaceAction(canvas.workspaceId, "canvas.edit");

  const existing = await db.taskLineRow.findMany({
    where: { canvasId: canvas.id },
    select: { order: true },
    orderBy: { order: "desc" },
    take: 1,
  });
  const nextOrder = existing.length > 0 ? existing[0].order + 1 : 0;
  const defaultName = parsed.data.name ?? `Linia ${Math.round(nextOrder) + 1}`;

  const row = await db.taskLineRow.create({
    data: {
      canvasId: canvas.id,
      name: defaultName,
      order: nextOrder,
    },
  });

  await writeAudit({
    workspaceId: canvas.workspaceId,
    objectType: "TaskLineRow",
    objectId: row.id,
    actorId: ctx.userId,
    action: "taskline.row.create",
    diff: { name: row.name },
  });

  return { ok: true, lineId: row.id, name: row.name, order: row.order };
}

// ─────────── renameLineAction ─────────────────────────────────────────────

const renameLineSchema = z.object({
  lineId: z.string().min(1),
  name: z.string().min(1).max(80),
});

export async function renameLineAction(
  input: z.infer<typeof renameLineSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = renameLineSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Bad input" };
  }

  const row = await db.taskLineRow.findUnique({
    where: { id: parsed.data.lineId },
    select: { id: true, canvas: { select: { workspaceId: true, deletedAt: true } } },
  });
  if (!row || row.canvas.deletedAt) {
    return { ok: false, error: "Linia nie istnieje." };
  }

  const ctx = await requireWorkspaceAction(row.canvas.workspaceId, "canvas.edit");
  await db.taskLineRow.update({
    where: { id: row.id },
    data: { name: parsed.data.name.trim() },
  });

  await writeAudit({
    workspaceId: row.canvas.workspaceId,
    objectType: "TaskLineRow",
    objectId: row.id,
    actorId: ctx.userId,
    action: "taskline.row.rename",
    diff: { name: parsed.data.name },
  });

  return { ok: true };
}

// ─────────── deleteLineAction ─────────────────────────────────────────────

const deleteLineSchema = z.object({
  lineId: z.string().min(1),
});

export async function deleteLineAction(
  input: z.infer<typeof deleteLineSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = deleteLineSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Bad input" };
  }

  const row = await db.taskLineRow.findUnique({
    where: { id: parsed.data.lineId },
    select: {
      id: true,
      canvasId: true,
      canvas: { select: { workspaceId: true, deletedAt: true } },
    },
  });
  if (!row || row.canvas.deletedAt) {
    return { ok: false, error: "Linia nie istnieje." };
  }

  const ctx = await requireWorkspaceAction(row.canvas.workspaceId, "canvas.edit");

  // Nie można skasować ostatniej linii (musi zostać przynajmniej jedna).
  const count = await db.taskLineRow.count({ where: { canvasId: row.canvasId } });
  if (count <= 1) {
    return { ok: false, error: "Nie możesz skasować ostatniej linii." };
  }

  // Skasuj też wszystkie nodes przypisane do tej linii (lineId == row.id w dataJson).
  await db.$transaction([
    db.processNode.deleteMany({
      where: {
        canvasId: row.canvasId,
        dataJson: { path: ["lineId"], equals: row.id },
      },
    }),
    db.taskLineRow.delete({ where: { id: row.id } }),
  ]);

  await writeAudit({
    workspaceId: row.canvas.workspaceId,
    objectType: "TaskLineRow",
    objectId: row.id,
    actorId: ctx.userId,
    action: "taskline.row.delete",
    diff: {},
  });

  return { ok: true };
}
