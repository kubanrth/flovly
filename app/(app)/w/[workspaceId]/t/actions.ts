"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import { requireWorkspaceAction } from "@/lib/workspace-guard";
import { broadcastUserChange, broadcastWorkspaceChange } from "@/lib/realtime";
import { sendNotificationEmail } from "@/lib/notify-email";
import { notifyBoardEvent } from "@/lib/notify-task-event";
import { writeAudit } from "@/lib/audit";
import {
  createTagSchema,
  createTaskSchema,
  toggleAssigneeSchema,
  toggleTagSchema,
  updateTaskSchema,
} from "@/lib/schemas/task";
import { checkLimit } from "@/lib/rate-limit";

type CreateFieldErrors = { title?: string };
type UpdateFieldErrors = {
  title?: string;
  descriptionJson?: string;
  statusColumnId?: string;
  startAt?: string;
  stopAt?: string;
};

export type CreateTaskState =
  | { ok: true; taskId: string }
  | { ok: false; error?: string; fieldErrors?: CreateFieldErrors }
  | null;

export type UpdateTaskState =
  | { ok: true; message: string }
  | { ok: false; error?: string; fieldErrors?: UpdateFieldErrors }
  | null;

function parseDate(v: FormDataEntryValue | null): Date | null {
  if (!v || typeof v !== "string" || v.trim() === "") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Resolve the user-chosen reminder offset into an absolute timestamp.
// Returns null when reminder is cleared OR when there is no stopAt to
// anchor the offset to — we never schedule a reminder without a deadline.
function resolveReminder(offset: string | undefined, stopAt: Date | null): Date | null {
  if (!offset || offset === "none" || offset === "") return null;
  if (!stopAt) return null;
  const hours: Record<string, number> = { "1h": 1, "4h": 4, "1d": 24, "3d": 72 };
  const hOff = hours[offset];
  if (hOff !== undefined) {
    return new Date(stopAt.getTime() - hOff * 60 * 60 * 1000);
  }
  // Custom ISO datetime.
  const custom = new Date(offset);
  return Number.isNaN(custom.getTime()) ? null : custom;
}

export async function createTaskAction(
  _prev: CreateTaskState,
  formData: FormData,
): Promise<CreateTaskState> {
  const parsed = createTaskSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    boardId: formData.get("boardId"),
    title: formData.get("title"),
    statusColumnId: formData.get("statusColumnId") || undefined,
  });

  if (!parsed.success) {
    const fe: CreateFieldErrors = {};
    for (const issue of parsed.error.issues) {
      if (issue.path[0] === "title") fe.title = issue.message;
    }
    return { ok: false, fieldErrors: fe };
  }

  const ctx = await requireWorkspaceAction(parsed.data.workspaceId, "task.create");

  const limit = await checkLimit("task.create", ctx.userId);
  if (!limit.ok) return { ok: false, error: limit.error };

  // F11-10: prefer explicit status column from caller (Kanban inline-add),
  // fall back to board's first column for the legacy modal flow.
  let pickedColumn: { id: string } | null = null;
  if (parsed.data.statusColumnId) {
    const explicit = await db.statusColumn.findFirst({
      where: { id: parsed.data.statusColumnId, boardId: parsed.data.boardId },
      select: { id: true },
    });
    if (explicit) pickedColumn = explicit;
  }
  if (!pickedColumn) {
    pickedColumn = await db.statusColumn.findFirst({
      where: { boardId: parsed.data.boardId },
      orderBy: { order: "asc" },
      select: { id: true },
    });
  }

  // Compute next rowOrder — last-in-column + 1 (or 1 if empty).
  const lastTask = pickedColumn
    ? await db.task.findFirst({
        where: { statusColumnId: pickedColumn.id, deletedAt: null },
        orderBy: { rowOrder: "desc" },
      })
    : null;

  const task = await db.task.create({
    data: {
      workspaceId: parsed.data.workspaceId,
      boardId: parsed.data.boardId,
      statusColumnId: pickedColumn?.id,
      creatorId: ctx.userId,
      title: parsed.data.title,
      rowOrder: (lastTask?.rowOrder ?? 0) + 1,
    },
  });

  await writeAudit({
    workspaceId: task.workspaceId,
    objectType: "Task",
    objectId: task.id,
    actorId: ctx.userId,
    action: "task.created",
    diff: { title: task.title },
  });

  revalidatePath(`/w/${parsed.data.workspaceId}`);
  await broadcastWorkspaceChange(task.workspaceId, {
    type: "task.changed",
    taskId: task.id,
    boardId: task.boardId,
  });

  // F12-K62: notyfikacja do całego workspace'u (minus creator) — Daniel
  // zażyczył sobie żeby team widział nowe zadania w inbox panelu.
  const [board, actor] = await Promise.all([
    db.board.findUnique({ where: { id: task.boardId }, select: { name: true } }),
    db.user.findUnique({ where: { id: ctx.userId }, select: { name: true, email: true } }),
  ]);
  await notifyBoardEvent({
    workspaceId: task.workspaceId,
    taskId: task.id,
    taskTitle: task.title,
    boardId: task.boardId,
    boardName: board?.name ?? null,
    actorId: ctx.userId,
    actorName: actor?.name ?? actor?.email ?? null,
    type: "task.created",
  });

  return { ok: true, taskId: task.id };
}

export async function updateTaskAction(
  _prev: UpdateTaskState,
  formData: FormData,
): Promise<UpdateTaskState> {
  const parsed = updateTaskSchema.safeParse({
    id: formData.get("id"),
    title: formData.get("title"),
    statusColumnId: formData.get("statusColumnId"),
    startAt: formData.get("startAt"),
    stopAt: formData.get("stopAt"),
    reminderOffset: formData.get("reminderOffset"),
  });

  if (!parsed.success) {
    const fe: UpdateFieldErrors = {};
    for (const issue of parsed.error.issues) {
      const k = issue.path[0];
      if (k === "title" || k === "statusColumnId" || k === "startAt" || k === "stopAt")
        fe[k] = issue.message;
    }
    return { ok: false, fieldErrors: fe };
  }

  const existing = await db.task.findUnique({ where: { id: parsed.data.id } });
  if (!existing) return { ok: false, error: "Zadanie nie istnieje." };

  const ctx = await requireWorkspaceAction(existing.workspaceId, "task.update");

  const stopAt = parseDate(formData.get("stopAt"));
  const reminderAt = resolveReminder(parsed.data.reminderOffset, stopAt);

  const updated = await db.task.update({
    where: { id: parsed.data.id },
    data: {
      title: parsed.data.title,
      // Note: descriptionJson is handled by updateTaskDescriptionAction.
      statusColumnId: parsed.data.statusColumnId || null,
      startAt: parseDate(formData.get("startAt")),
      stopAt,
      reminderAt,
      // Changing reminderAt re-arms the cron — clear previous "sent" flag so
      // the new reminder will fire. Leaving it set blocks re-sends when the
      // user tweaks other fields.
      reminderSentAt:
        reminderAt &&
        existing.reminderAt &&
        reminderAt.getTime() !== existing.reminderAt.getTime()
          ? null
          : undefined,
      version: { increment: 1 },
    },
  });

  await writeAudit({
    workspaceId: updated.workspaceId,
    objectType: "Task",
    objectId: updated.id,
    actorId: ctx.userId,
    action: "task.updated",
    diff: { title: updated.title },
  });

  // F12-K44 P6: tylko task page revalidate. Workspace overview dostaje
  // refresh przez broadcastWorkspaceChange + router.refresh w klientach
  // — podwójny revalidate był kosztownym duplikatem.
  revalidatePath(`/w/${updated.workspaceId}/t/${updated.id}`);
  await broadcastWorkspaceChange(updated.workspaceId, {
    type: "task.changed",
    taskId: updated.id,
    boardId: updated.boardId,
  });
  return { ok: true, message: "Zapisano." };
}

export async function deleteTaskAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const formWorkspaceId = String(formData.get("workspaceId") ?? "");
  if (!id || !formWorkspaceId) return;

  // F12-K43 H1: zamiast ufać workspaceId z form'y, fetch'ujemy task'a
  // z DB i guardujemy na jego REALNY workspaceId. Bez tego user z
  // task.delete w workspace A mógł wysłać id task'a z workspace B
  // (gdzie nie jest member'em) i guard sprawdzał A — IDOR.
  const existing = await db.task.findUnique({
    where: { id },
    select: { id: true, workspaceId: true, deletedAt: true },
  });
  if (!existing || existing.deletedAt) return;
  // Defensive: form workspaceId musi się zgadzać z tym w bazie.
  if (existing.workspaceId !== formWorkspaceId) return;

  const ctx = await requireWorkspaceAction(existing.workspaceId, "task.delete");

  await db.task.update({ where: { id }, data: { deletedAt: new Date() } });
  await writeAudit({
    workspaceId: existing.workspaceId,
    objectType: "Task",
    objectId: id,
    actorId: ctx.userId,
    action: "task.deleted",
  });
  revalidatePath(`/w/${existing.workspaceId}`);
  await broadcastWorkspaceChange(existing.workspaceId, {
    type: "task.changed",
    taskId: id,
  });
  redirect(`/w/${existing.workspaceId}`);
}

// F10-X T2.2: bulk operations from the table multi-select toolbar.
// Stays on the same page (no redirect) — caller refreshes.
export async function bulkDeleteTasksAction(formData: FormData) {
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const idsRaw = String(formData.get("ids") ?? "");
  const ids = idsRaw.split(",").filter(Boolean);
  if (!workspaceId || ids.length === 0) return;
  const ctx = await requireWorkspaceAction(workspaceId, "task.delete");

  await db.task.updateMany({
    where: { id: { in: ids }, workspaceId },
    data: { deletedAt: new Date() },
  });
  await writeAudit({
    workspaceId,
    objectType: "Task",
    objectId: ids[0],
    actorId: ctx.userId,
    action: "task.bulkDeleted",
    diff: { count: ids.length },
  });
  revalidatePath(`/w/${workspaceId}`);
  await broadcastWorkspaceChange(workspaceId, { type: "task.changed" });
}

export async function bulkUpdateStatusAction(formData: FormData) {
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const idsRaw = String(formData.get("ids") ?? "");
  const statusColumnId = String(formData.get("statusColumnId") ?? "");
  const ids = idsRaw.split(",").filter(Boolean);
  if (!workspaceId || ids.length === 0) return;
  const ctx = await requireWorkspaceAction(workspaceId, "task.update");

  await db.task.updateMany({
    where: { id: { in: ids }, workspaceId },
    data: { statusColumnId: statusColumnId || null },
  });
  await writeAudit({
    workspaceId,
    objectType: "Task",
    objectId: ids[0],
    actorId: ctx.userId,
    action: "task.bulkStatusChanged",
    diff: { count: ids.length, statusColumnId: statusColumnId || null },
  });
  revalidatePath(`/w/${workspaceId}`);
  await broadcastWorkspaceChange(workspaceId, { type: "task.changed" });
}

// F9-03: dedicated description save — lets the task-detail UI flip
// description to "view mode" (rendered prose) after save without
// round-tripping other fields.
const updateDescriptionSchema = z.object({
  id: z.string().min(1),
  descriptionJson: z.string().max(50_000).optional().or(z.literal("")),
});

export async function updateTaskDescriptionAction(formData: FormData) {
  const parsed = updateDescriptionSchema.safeParse({
    id: formData.get("id"),
    descriptionJson: formData.get("descriptionJson") ?? "",
  });
  if (!parsed.success) return;

  const existing = await db.task.findUnique({ where: { id: parsed.data.id } });
  if (!existing) return;
  const ctx = await requireWorkspaceAction(existing.workspaceId, "task.update");

  let doc: Prisma.InputJsonValue | null = null;
  if (parsed.data.descriptionJson && parsed.data.descriptionJson.length > 0) {
    try {
      const parsedDoc = JSON.parse(parsed.data.descriptionJson);
      if (parsedDoc && typeof parsedDoc === "object" && (parsedDoc as { type?: string }).type === "doc") {
        doc = parsedDoc as Prisma.InputJsonValue;
      }
    } catch {
      /* malformed → treat as null */
    }
  }

  await db.task.update({
    where: { id: parsed.data.id },
    data: {
      descriptionJson: doc ?? Prisma.DbNull,
      version: { increment: 1 },
    },
  });

  await writeAudit({
    workspaceId: existing.workspaceId,
    objectType: "Task",
    objectId: existing.id,
    actorId: ctx.userId,
    action: "task.descriptionUpdated",
  });

  revalidatePath(`/w/${existing.workspaceId}/t/${existing.id}`);
}

// Need z import for the new schema above.
// (z is imported at top of file via "zod"? let's check)

// Small-field patches used by the Table view's inline-edit cells.
// Unlike updateTaskAction, this updates only the fields present in
// the FormData, so a click-to-edit title or a status dropdown can
// each fire their own action without round-tripping the whole task.
export async function patchTaskAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const existing = await db.task.findUnique({ where: { id } });
  if (!existing) return;
  const ctx = await requireWorkspaceAction(existing.workspaceId, "task.update");

  const data: Record<string, unknown> = {};
  const keys = ["title", "statusColumnId", "startAt", "stopAt", "rowOrder"] as const;
  let hasChange = false;

  for (const k of keys) {
    const raw = formData.get(k);
    if (raw === null) continue;
    if (k === "title") {
      const v = String(raw).trim();
      if (v.length === 0 || v.length > 200) continue;
      data.title = v;
      hasChange = true;
    } else if (k === "statusColumnId") {
      const v = String(raw);
      data.statusColumnId = v === "" ? null : v;
      hasChange = true;
    } else if (k === "startAt" || k === "stopAt") {
      data[k] = parseDate(raw);
      hasChange = true;
    } else if (k === "rowOrder") {
      const n = Number(raw);
      if (!Number.isFinite(n)) continue;
      data.rowOrder = n;
      hasChange = true;
    }
  }

  if (!hasChange) return;

  // F12-K62: zapamiętuję poprzedni status PRZED update'em żeby móc
  // wykryć zmianę i wysłać powiadomienie z "X → Y".
  const statusChanged =
    "statusColumnId" in data && data.statusColumnId !== existing.statusColumnId;
  const previousStatusColumnId = existing.statusColumnId;

  const updated = await db.task.update({
    where: { id },
    data: { ...data, version: { increment: 1 } },
  });

  await writeAudit({
    workspaceId: updated.workspaceId,
    objectType: "Task",
    objectId: updated.id,
    actorId: ctx.userId,
    action: "task.patched",
    diff: data as Prisma.InputJsonValue,
  });

  // F12-K44 P6: dropujemy revalidatePath('/w/<wid>') — task page revalidate
  // + layout-level (board) revalidate już pokrywają wszystkie views.
  // Workspace overview łapie zmianę przez broadcastWorkspaceChange.
  revalidatePath(`/w/${updated.workspaceId}/t/${updated.id}`);
  // F12-K4: layout-level revalidation covers /table + /kanban + /v/[viewId]
  // + /roadmap + /gantt with one call. Without it, edits made in the task
  // modal stay invisible on custom views until a hard reload.
  revalidatePath(`/w/[workspaceId]/b/[boardId]`, "layout");
  await broadcastWorkspaceChange(updated.workspaceId, {
    type: "task.changed",
    taskId: updated.id,
    boardId: updated.boardId,
  });

  // F12-K62: notyfikacja do workspace'u (minus actor) o zmianie statusu.
  // Tylko gdy faktycznie statusColumnId się zmieniło — patch może być
  // czysto title/date i nie chcemy spamować w takim przypadku.
  if (statusChanged) {
    const [board, actor, fromCol, toCol] = await Promise.all([
      db.board.findUnique({ where: { id: updated.boardId }, select: { name: true } }),
      db.user.findUnique({ where: { id: ctx.userId }, select: { name: true, email: true } }),
      previousStatusColumnId
        ? db.statusColumn.findUnique({
            where: { id: previousStatusColumnId },
            select: { name: true },
          })
        : Promise.resolve(null),
      updated.statusColumnId
        ? db.statusColumn.findUnique({
            where: { id: updated.statusColumnId },
            select: { name: true },
          })
        : Promise.resolve(null),
    ]);
    await notifyBoardEvent({
      workspaceId: updated.workspaceId,
      taskId: updated.id,
      taskTitle: updated.title,
      boardId: updated.boardId,
      boardName: board?.name ?? null,
      actorId: ctx.userId,
      actorName: actor?.name ?? actor?.email ?? null,
      type: "task.status.changed",
      fromStatusName: fromCol?.name ?? null,
      toStatusName: toCol?.name ?? null,
    });
  }
}

export async function toggleAssigneeAction(formData: FormData) {
  const parsed = toggleAssigneeSchema.safeParse({
    taskId: formData.get("taskId"),
    userId: formData.get("userId"),
  });
  if (!parsed.success) return;

  const task = await db.task.findUnique({ where: { id: parsed.data.taskId } });
  if (!task) return;

  const ctx = await requireWorkspaceAction(task.workspaceId, "task.assignUsers");

  // Assignee must be a member of the workspace.
  const membership = await db.workspaceMembership.findUnique({
    where: {
      workspaceId_userId: { workspaceId: task.workspaceId, userId: parsed.data.userId },
    },
  });
  if (!membership) return;

  const existing = await db.taskAssignee.findUnique({
    where: { taskId_userId: { taskId: parsed.data.taskId, userId: parsed.data.userId } },
  });

  if (existing) {
    await db.taskAssignee.delete({
      where: { taskId_userId: { taskId: parsed.data.taskId, userId: parsed.data.userId } },
    });
  } else {
    await db.taskAssignee.create({
      data: { taskId: parsed.data.taskId, userId: parsed.data.userId },
    });
    // F12-K21: notyfikacja w inbox'ie dla osoby przypisanej. Skip jeśli
    // user przypisał sam siebie (no point notyfikować). Klient zgłosił
    // 'mimo tego ze jestem przypisany do kilku zadan to nic mi sie w
    // panelu powiadomien nie pokazuje' — wcześniej assign nie tworzył
    // żadnej Notification (tylko mention'y i poll'e to robiły).
    if (parsed.data.userId !== ctx.userId) {
      const board = await db.board.findUnique({
        where: { id: task.boardId },
        select: { name: true },
      });
      const actor = await db.user.findUnique({
        where: { id: ctx.userId },
        select: { name: true, email: true },
      });
      const notif = await db.notification.create({
        data: {
          userId: parsed.data.userId,
          type: "task.assigned",
          payload: {
            workspaceId: task.workspaceId,
            taskId: task.id,
            taskTitle: task.title,
            boardId: task.boardId,
            boardName: board?.name ?? null,
            actorId: ctx.userId,
            actorName: actor?.name ?? actor?.email ?? null,
          } as Prisma.InputJsonValue,
        },
        select: { id: true, userId: true },
      });
      // F12-K35: live toast w prawym górnym rogu recipienta.
      await broadcastUserChange(notif.userId, {
        kind: "notification.new",
        id: notif.id,
      });
      // F12-K39: email do recipient'a.
      const actorLabel = actor?.name ?? actor?.email ?? "Ktoś";
      await sendNotificationEmail({
        to: { userId: parsed.data.userId },
        subject: `Przypisanie do zadania: ${task.title}`,
        eyebrow: "Przypisanie do zadania",
        attribution: `od ${actorLabel}`,
        title: task.title,
        body: `${actorLabel} przypisał(a) Cię do zadania${
          board?.name ? ` na tablicy ${board.name}` : ""
        }. Otwórz zadanie, żeby zobaczyć szczegóły, status i komentarze.`,
        ctaLabel: "Otwórz zadanie",
        ctaPath: `/w/${task.workspaceId}/t/${task.id}`,
      });
    }
  }

  await writeAudit({
    workspaceId: task.workspaceId,
    objectType: "Task",
    objectId: task.id,
    actorId: ctx.userId,
    action: existing ? "task.assigneeRemoved" : "task.assigneeAdded",
    diff: { userId: parsed.data.userId },
  });

  revalidatePath(`/w/${task.workspaceId}/t/${task.id}`);
  // F12-K4: layout-level revalidation covers default /table + /kanban
  // AND custom views /v/[viewId], /roadmap, /gantt — without it, custom
  // views show stale assignees until manual reload. Pattern form is
  // required by Next.js when path contains dynamic segments + 'layout'.
  revalidatePath(`/w/[workspaceId]/b/[boardId]`, "layout");
  await broadcastWorkspaceChange(task.workspaceId, {
    type: "task.changed",
    taskId: task.id,
    boardId: task.boardId,
  });
}

export async function toggleTagAction(formData: FormData) {
  const parsed = toggleTagSchema.safeParse({
    taskId: formData.get("taskId"),
    tagId: formData.get("tagId"),
  });
  if (!parsed.success) return;

  const task = await db.task.findUnique({ where: { id: parsed.data.taskId } });
  if (!task) return;

  const ctx = await requireWorkspaceAction(task.workspaceId, "task.update");

  const existing = await db.taskTag.findUnique({
    where: { taskId_tagId: { taskId: parsed.data.taskId, tagId: parsed.data.tagId } },
  });

  if (existing) {
    await db.taskTag.delete({
      where: { taskId_tagId: { taskId: parsed.data.taskId, tagId: parsed.data.tagId } },
    });
  } else {
    await db.taskTag.create({
      data: { taskId: parsed.data.taskId, tagId: parsed.data.tagId },
    });
  }

  await writeAudit({
    workspaceId: task.workspaceId,
    objectType: "Task",
    objectId: task.id,
    actorId: ctx.userId,
    action: existing ? "task.tagRemoved" : "task.tagAdded",
    diff: { tagId: parsed.data.tagId },
  });

  revalidatePath(`/w/${task.workspaceId}/t/${task.id}`);
  // F12-K4: same layout revalidation as toggleAssigneeAction so tags
  // toggled in the task modal propagate to all board views.
  revalidatePath(`/w/[workspaceId]/b/[boardId]`, "layout");
  await broadcastWorkspaceChange(task.workspaceId, {
    type: "task.changed",
    taskId: task.id,
    boardId: task.boardId,
  });
}

export async function createTagAction(formData: FormData) {
  const parsed = createTagSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    name: formData.get("name"),
    colorHex: formData.get("colorHex"),
  });
  if (!parsed.success) return;
  const ctx = await requireWorkspaceAction(parsed.data.workspaceId, "tag.manage");

  await db.tag.upsert({
    where: {
      workspaceId_name: { workspaceId: parsed.data.workspaceId, name: parsed.data.name },
    },
    update: { colorHex: parsed.data.colorHex },
    create: {
      workspaceId: parsed.data.workspaceId,
      name: parsed.data.name,
      colorHex: parsed.data.colorHex,
      creatorId: ctx.userId,
    },
  });
  revalidatePath(`/w/${parsed.data.workspaceId}`);
}
