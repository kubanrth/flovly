"use server";

// Per-task time tracking — start / pause / complete. Three states:
//   Idle       — timerStartedAt=null, timerCompletedAt=null
//   Running    — timerStartedAt set
//   Completed  — timerCompletedAt set (locked; no Reset path yet)
// Permission: task.update.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireWorkspaceAction } from "@/lib/workspace-guard";
import { writeAudit } from "@/lib/audit";
import { broadcastWorkspaceChange } from "@/lib/realtime";

const timerSchema = z.object({ id: z.string().min(1) });

async function loadTaskForTimer(id: string) {
  return db.task.findUnique({
    where: { id },
    select: {
      id: true,
      workspaceId: true,
      timeTrackedSeconds: true,
      timerStartedAt: true,
      timerCompletedAt: true,
    },
  });
}

// Idempotent: a second 'Start' click never doubles tracked time.
export async function startTaskTimerAction(formData: FormData) {
  const parsed = timerSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return;

  const task = await loadTaskForTimer(parsed.data.id);
  if (!task) return;
  const ctx = await requireWorkspaceAction(task.workspaceId, "task.update");

  if (task.timerCompletedAt) return;
  if (task.timerStartedAt) return;

  await db.task.update({
    where: { id: task.id },
    data: { timerStartedAt: new Date() },
  });
  await writeAudit({
    workspaceId: task.workspaceId,
    objectType: "Task",
    objectId: task.id,
    actorId: ctx.userId,
    action: "task.timerStarted",
  });
  await broadcastWorkspaceChange(task.workspaceId, {
    type: "task.changed",
    taskId: task.id,
  });
  revalidatePath(`/w/${task.workspaceId}/t/${task.id}`);
}

// Pause adds elapsed to the accumulator and clears timerStartedAt;
// task returns to Idle with accumulated > 0 and can be resumed.
export async function pauseTaskTimerAction(formData: FormData) {
  const parsed = timerSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return;

  const task = await loadTaskForTimer(parsed.data.id);
  if (!task) return;
  const ctx = await requireWorkspaceAction(task.workspaceId, "task.update");

  if (!task.timerStartedAt) return;
  if (task.timerCompletedAt) return;

  const now = new Date();
  const startedAt = task.timerStartedAt;
  const elapsed = Math.floor(
    (now.getTime() - startedAt.getTime()) / 1000,
  );
  // F12-K133: pobierz rate z User (snapshot dla TimeEntry).
  const user = await db.user.findUnique({
    where: { id: ctx.userId },
    select: { hourlyRateCents: true },
  });
  await db.$transaction([
    db.task.update({
      where: { id: task.id },
      data: {
        timeTrackedSeconds: { increment: Math.max(0, elapsed) },
        timerStartedAt: null,
      },
    }),
    // F12-K133: sesja timera → TimeEntry w timesheet + raportach.
    ...(elapsed >= 1
      ? [
          db.timeEntry.create({
            data: {
              workspaceId: task.workspaceId,
              taskId: task.id,
              userId: ctx.userId,
              startedAt,
              stoppedAt: now,
              durationSeconds: elapsed,
              rateSnapshotCents: user?.hourlyRateCents ?? null,
            },
          }),
        ]
      : []),
  ]);
  await writeAudit({
    workspaceId: task.workspaceId,
    objectType: "Task",
    objectId: task.id,
    actorId: ctx.userId,
    action: "task.timerPaused",
    diff: { sessionSeconds: elapsed },
  });
  revalidatePath(`/w/${task.workspaceId}/time`);
  await broadcastWorkspaceChange(task.workspaceId, {
    type: "task.changed",
    taskId: task.id,
  });
  revalidatePath(`/w/${task.workspaceId}/t/${task.id}`);
}

// Complete flushes any running session to the accumulator and locks the timer.
export async function completeTaskTimerAction(formData: FormData) {
  const parsed = timerSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return;

  const task = await loadTaskForTimer(parsed.data.id);
  if (!task) return;
  const ctx = await requireWorkspaceAction(task.workspaceId, "task.update");

  if (task.timerCompletedAt) return;

  const now = new Date();
  const runningStart = task.timerStartedAt;
  const extraSeconds = runningStart
    ? Math.max(0, Math.floor((now.getTime() - runningStart.getTime()) / 1000))
    : 0;

  // F12-K133: rate snapshot dla TimeEntry (jeśli była sesja).
  const user = runningStart
    ? await db.user.findUnique({
        where: { id: ctx.userId },
        select: { hourlyRateCents: true },
      })
    : null;

  await db.$transaction([
    db.task.update({
      where: { id: task.id },
      data: {
        timeTrackedSeconds: task.timeTrackedSeconds + extraSeconds,
        timerStartedAt: null,
        timerCompletedAt: now,
      },
    }),
    ...(runningStart && extraSeconds >= 1
      ? [
          db.timeEntry.create({
            data: {
              workspaceId: task.workspaceId,
              taskId: task.id,
              userId: ctx.userId,
              startedAt: runningStart,
              stoppedAt: now,
              durationSeconds: extraSeconds,
              rateSnapshotCents: user?.hourlyRateCents ?? null,
            },
          }),
        ]
      : []),
  ]);
  await writeAudit({
    workspaceId: task.workspaceId,
    objectType: "Task",
    objectId: task.id,
    actorId: ctx.userId,
    action: "task.timerCompleted",
    diff: { totalSeconds: task.timeTrackedSeconds + extraSeconds },
  });
  await broadcastWorkspaceChange(task.workspaceId, {
    type: "task.changed",
    taskId: task.id,
  });
  revalidatePath(`/w/${task.workspaceId}/t/${task.id}`);
  revalidatePath(`/w/${task.workspaceId}/time`);
}
