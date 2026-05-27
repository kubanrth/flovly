import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isCronAuthorized } from "@/lib/cron-auth";

// Vercel Cron daily. For each task with recurrenceRule, if today matches
// the rule and no instance was spawned yet, clone the template (title,
// description, status, assignees, tags) and bump recurrenceLastSpawnAt
// (UTC-day guard against double-spawn).

interface RecurrenceRule {
  freq: "daily" | "weekly" | "monthly";
  day?: number;
}

function shouldSpawn(rule: RecurrenceRule, now: Date): boolean {
  if (rule.freq === "daily") return true;
  if (rule.freq === "weekly") {
    if (typeof rule.day !== "number") return false;
    return now.getDay() === rule.day;
  }
  if (rule.freq === "monthly") {
    if (typeof rule.day !== "number") return false;
    // Clamp do last day of month — day=31 fires on Feb 28/29.
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const fireDay = Math.min(rule.day, lastDayOfMonth);
    return now.getDate() === fireDay;
  }
  return false;
}

function isSameUtcDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

async function runSweep(now: Date) {
  // Full scan acceptable — recurrence templates are rare.
  const templates = await db.task.findMany({
    where: {
      recurrenceRule: { not: { equals: null } },
      deletedAt: null,
    },
    take: 1000,
    include: {
      assignees: { select: { userId: true } },
      tags: { select: { tagId: true } },
    },
  });

  let spawned = 0;
  const skipped: string[] = [];

  for (const t of templates) {
    const rule = t.recurrenceRule as unknown;
    if (!rule || typeof rule !== "object") {
      skipped.push(`${t.id}: invalid rule`);
      continue;
    }
    if (!shouldSpawn(rule as RecurrenceRule, now)) continue;
    if (t.recurrenceLastSpawnAt && isSameUtcDay(t.recurrenceLastSpawnAt, now)) continue;

    const last = t.statusColumnId
      ? await db.task.findFirst({
          where: { statusColumnId: t.statusColumnId, deletedAt: null },
          orderBy: { rowOrder: "desc" },
          select: { rowOrder: true },
        })
      : null;

    const instance = await db.task.create({
      data: {
        workspaceId: t.workspaceId,
        boardId: t.boardId,
        statusColumnId: t.statusColumnId,
        creatorId: t.creatorId,
        title: t.title,
        descriptionJson: t.descriptionJson ?? undefined,
        rowOrder: (last?.rowOrder ?? 0) + 1,
        recurrenceParentId: t.id,
      },
    });

    if (t.assignees.length > 0) {
      await db.taskAssignee.createMany({
        data: t.assignees.map((a) => ({ taskId: instance.id, userId: a.userId })),
        skipDuplicates: true,
      });
    }
    if (t.tags.length > 0) {
      await db.taskTag.createMany({
        data: t.tags.map((tg) => ({ taskId: instance.id, tagId: tg.tagId })),
        skipDuplicates: true,
      });
    }

    await db.task.update({
      where: { id: t.id },
      data: { recurrenceLastSpawnAt: now },
    });
    spawned++;
  }

  return { templates: templates.length, spawned, skipped };
}

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return new NextResponse("Unauthorized", { status: 401 });
  try {
    const result = await runSweep(new Date());
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
