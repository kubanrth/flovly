"use server";

// F12-K133: TimeCamp-like server actions.
// Zakres: manual entry create/update/delete, approve/unapprove (admin),
// timer stop → entry (wywoływane z komponentu Task timera).

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireWorkspaceMembership, requireWorkspaceAction } from "@/lib/workspace-guard";
import { writeAudit } from "@/lib/audit";

const createSchema = z.object({
  workspaceId: z.string().min(1),
  taskId: z.string().min(1).optional(),
  startedAt: z.string().min(1),
  stoppedAt: z.string().min(1),
  note: z.string().max(500).optional(),
  billable: z.enum(["true", "false"]).optional(),
});

export type CreateTimeEntryState =
  | { ok: true; id: string }
  | { ok: false; error?: string; fieldErrors?: { startedAt?: string; stoppedAt?: string } }
  | null;

export async function createTimeEntryAction(
  _prev: CreateTimeEntryState,
  formData: FormData,
): Promise<CreateTimeEntryState> {
  const parsed = createSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    taskId: formData.get("taskId") || undefined,
    startedAt: formData.get("startedAt"),
    stoppedAt: formData.get("stoppedAt"),
    note: formData.get("note") || undefined,
    billable: formData.get("billable") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: "Nieprawidłowe dane." };
  }

  const start = new Date(parsed.data.startedAt);
  const stop = new Date(parsed.data.stoppedAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(stop.getTime())) {
    return { ok: false, fieldErrors: { startedAt: "Zły format daty." } };
  }
  const duration = Math.round((stop.getTime() - start.getTime()) / 1000);
  if (duration <= 0) {
    return { ok: false, fieldErrors: { stoppedAt: "Koniec musi być po starcie." } };
  }
  if (duration > 24 * 3600) {
    return { ok: false, fieldErrors: { stoppedAt: "Wpis nie może być dłuższy niż 24h." } };
  }

  const ctx = await requireWorkspaceMembership(parsed.data.workspaceId);

  // Guard: task należy do tego workspace (jeśli podany).
  if (parsed.data.taskId) {
    const task = await db.task.findFirst({
      where: { id: parsed.data.taskId, workspaceId: parsed.data.workspaceId },
      select: { id: true },
    });
    if (!task) return { ok: false, error: "Zadanie nie istnieje w tym workspace." };
  }

  // Rate snapshot — bierzemy hourlyRateCents z User w chwili tworzenia.
  const user = await db.user.findUnique({
    where: { id: ctx.userId },
    select: { hourlyRateCents: true },
  });

  const entry = await db.timeEntry.create({
    data: {
      workspaceId: parsed.data.workspaceId,
      taskId: parsed.data.taskId ?? null,
      userId: ctx.userId,
      startedAt: start,
      stoppedAt: stop,
      durationSeconds: duration,
      note: parsed.data.note ?? null,
      billable: parsed.data.billable !== "false",
      rateSnapshotCents: user?.hourlyRateCents ?? null,
    },
    select: { id: true },
  });

  void writeAudit({
    workspaceId: parsed.data.workspaceId,
    objectType: "TimeEntry",
    objectId: entry.id,
    actorId: ctx.userId,
    action: "timeEntry.created",
    diff: { durationSeconds: duration, taskId: parsed.data.taskId ?? null },
  }).catch(() => {});

  revalidatePath(`/w/${parsed.data.workspaceId}/time`);
  return { ok: true, id: entry.id };
}

const deleteSchema = z.object({ id: z.string().min(1) });

export async function deleteTimeEntryAction(formData: FormData) {
  const parsed = deleteSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return;

  const entry = await db.timeEntry.findUnique({
    where: { id: parsed.data.id },
    select: { workspaceId: true, userId: true, deletedAt: true, approvedAt: true },
  });
  if (!entry || entry.deletedAt) return;

  const ctx = await requireWorkspaceMembership(entry.workspaceId);
  // User może usuwać tylko własne + niezatwierdzone wpisy. Admin (workspace)
  // może usunąć każdy.
  const isAdmin = ctx.role === "ADMIN";
  const isOwner = ctx.userId === entry.userId;
  if (!isAdmin && (!isOwner || entry.approvedAt)) return;

  await db.timeEntry.update({
    where: { id: parsed.data.id },
    data: { deletedAt: new Date() },
  });

  revalidatePath(`/w/${entry.workspaceId}/time`);
}

const approveSchema = z.object({
  id: z.string().min(1),
  approve: z.enum(["true", "false"]),
});

export async function approveTimeEntryAction(formData: FormData) {
  const parsed = approveSchema.safeParse({
    id: formData.get("id"),
    approve: formData.get("approve"),
  });
  if (!parsed.success) return;

  const entry = await db.timeEntry.findUnique({
    where: { id: parsed.data.id },
    select: { workspaceId: true, deletedAt: true },
  });
  if (!entry || entry.deletedAt) return;

  // Only workspace admin can approve.
  const ctx = await requireWorkspaceAction(entry.workspaceId, "workspace.updateSettings");
  const approving = parsed.data.approve === "true";

  await db.timeEntry.update({
    where: { id: parsed.data.id },
    data: {
      approvedById: approving ? ctx.userId : null,
      approvedAt: approving ? new Date() : null,
    },
  });

  revalidatePath(`/w/${entry.workspaceId}/time`);
}

const rateSchema = z.object({
  hourlyRatePln: z.string().max(20),
});

export async function setMyHourlyRateAction(formData: FormData) {
  const parsed = rateSchema.safeParse({
    hourlyRatePln: formData.get("hourlyRatePln"),
  });
  if (!parsed.success) return;

  // Any authenticated user can set their own rate — no workspace context.
  // Uses same auth as workspace-guard but without workspace.
  const raw = parsed.data.hourlyRatePln.trim().replace(",", ".");
  const num = raw === "" ? null : Number(raw);
  const cents = num !== null && Number.isFinite(num) && num >= 0 ? Math.round(num * 100) : null;

  const { auth } = await import("@/lib/auth");
  const session = await auth();
  if (!session?.user) return;

  await db.user.update({
    where: { id: session.user.id },
    data: { hourlyRateCents: cents },
  });
}

// F12-K133: timer stop → TimeEntry. Wywoływane z Task timer widget'a.
// Jeśli task ma timerStartedAt set, tworzy Entry (start=timerStartedAt,
// stop=now) i clear'uje timerStartedAt. Dodaje delta do task.timeTrackedSeconds
// (backwards-compat z F12-K40 istniejącym counter'em).
const stopSchema = z.object({ taskId: z.string().min(1) });

export async function stopTimerToEntryAction(
  input: { taskId: string },
): Promise<{ ok: true; durationSeconds: number } | { ok: false; error: string }> {
  const parsed = stopSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Bad request." };

  const task = await db.task.findUnique({
    where: { id: parsed.data.taskId },
    select: {
      id: true,
      workspaceId: true,
      timerStartedAt: true,
      timeTrackedSeconds: true,
    },
  });
  if (!task || !task.timerStartedAt) {
    return { ok: false, error: "Timer nie jest uruchomiony." };
  }

  const ctx = await requireWorkspaceMembership(task.workspaceId);

  const now = new Date();
  const durationSeconds = Math.max(
    1,
    Math.round((now.getTime() - task.timerStartedAt.getTime()) / 1000),
  );

  const user = await db.user.findUnique({
    where: { id: ctx.userId },
    select: { hourlyRateCents: true },
  });

  await db.$transaction([
    db.timeEntry.create({
      data: {
        workspaceId: task.workspaceId,
        taskId: task.id,
        userId: ctx.userId,
        startedAt: task.timerStartedAt,
        stoppedAt: now,
        durationSeconds,
        rateSnapshotCents: user?.hourlyRateCents ?? null,
      },
    }),
    db.task.update({
      where: { id: task.id },
      data: {
        timerStartedAt: null,
        timeTrackedSeconds: task.timeTrackedSeconds + durationSeconds,
      },
    }),
  ]);

  revalidatePath(`/w/${task.workspaceId}/time`);
  revalidatePath(`/w/${task.workspaceId}/t/${task.id}`);

  return { ok: true, durationSeconds };
}
