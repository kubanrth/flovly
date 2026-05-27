"use server";

// recurrenceRule is JSON so future fields (cron expression, end date) don't
// require a migration. /api/cron/spawn-recurring reads it and spawns instances.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import { requireWorkspaceAction } from "@/lib/workspace-guard";
import { writeAudit } from "@/lib/audit";

const recurrenceRuleSchema = z.discriminatedUnion("freq", [
  z.object({ freq: z.literal("daily") }),
  z.object({ freq: z.literal("weekly"), day: z.number().int().min(0).max(6) }),
  z.object({ freq: z.literal("monthly"), day: z.number().int().min(1).max(31) }),
]);

const setRecurrenceSchema = z.object({
  taskId: z.string().min(1),
  // Empty string = clear recurrence.
  rule: z.string().max(500).optional(),
});

export async function setTaskRecurrenceAction(formData: FormData) {
  const parsed = setRecurrenceSchema.safeParse({
    taskId: formData.get("taskId"),
    rule: formData.get("rule") ?? "",
  });
  if (!parsed.success) return;

  const task = await db.task.findUnique({
    where: { id: parsed.data.taskId },
    select: { id: true, workspaceId: true, boardId: true },
  });
  if (!task) return;
  const ctx = await requireWorkspaceAction(task.workspaceId, "task.update");

  let nextRule: Prisma.InputJsonValue | typeof Prisma.DbNull = Prisma.DbNull;
  if (parsed.data.rule && parsed.data.rule.length > 0) {
    let parsedRule: unknown;
    try {
      parsedRule = JSON.parse(parsed.data.rule);
    } catch {
      return;
    }
    const ruleResult = recurrenceRuleSchema.safeParse(parsedRule);
    if (!ruleResult.success) return;
    nextRule = ruleResult.data as Prisma.InputJsonValue;
  }

  await db.task.update({
    where: { id: task.id },
    data: { recurrenceRule: nextRule },
  });
  await writeAudit({
    workspaceId: task.workspaceId,
    objectType: "Task",
    objectId: task.id,
    actorId: ctx.userId,
    action: "task.recurrenceUpdated",
    diff: { rule: parsed.data.rule || null },
  });
  revalidatePath(`/w/${task.workspaceId}/t/${task.id}`);
  revalidatePath(`/w/${task.workspaceId}/b/${task.boardId}/table`);
}
