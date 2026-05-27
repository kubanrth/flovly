"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireWorkspaceAction } from "@/lib/workspace-guard";
import { writeAudit } from "@/lib/audit";
import { broadcastUserChange } from "@/lib/realtime";
import { sendNotificationEmail } from "@/lib/notify-email";

const createPollSchema = z.object({
  taskId: z.string().min(1),
  question: z.string().trim().min(3).max(280),
  // options arrive as repeated `option` fields; parsed separately
});

export async function createPollAction(formData: FormData) {
  const parsed = createPollSchema.safeParse({
    taskId: formData.get("taskId"),
    question: formData.get("question"),
  });
  if (!parsed.success) return;

  const rawOptions = formData
    .getAll("option")
    .map((v) => String(v).trim())
    .filter((v) => v.length > 0 && v.length <= 120);
  if (rawOptions.length < 2 || rawOptions.length > 5) return;

  const task = await db.task.findUnique({
    where: { id: parsed.data.taskId },
    select: {
      workspaceId: true,
      boardId: true,
      title: true,
      board: { select: { name: true } },
      poll: { select: { id: true } },
    },
  });
  if (!task || task.poll) return;

  const ctx = await requireWorkspaceAction(task.workspaceId, "poll.manage");

  await db.taskPoll.create({
    data: {
      taskId: parsed.data.taskId,
      question: parsed.data.question,
      authorId: ctx.userId,
      options: {
        create: rawOptions.map((label, i) => ({ label, order: i })),
      },
    },
  });

  // Notify every workspace member except the author.
  const members = await db.workspaceMembership.findMany({
    where: {
      workspaceId: task.workspaceId,
      userId: { not: ctx.userId },
    },
    select: { userId: true },
  });
  if (members.length > 0) {
    // Per-user create to get ids for the realtime broadcast.
    const created = await Promise.all(
      members.map((m) =>
        db.notification.create({
          data: {
            userId: m.userId,
            type: "poll.created",
            payload: {
              workspaceId: task.workspaceId,
              taskId: parsed.data.taskId,
              taskTitle: task.title,
              boardName: task.board.name,
              question: parsed.data.question,
              authorName: null,
            },
          },
          select: { id: true, userId: true },
        }),
      ),
    );
    await Promise.all(
      created.map((n) =>
        broadcastUserChange(n.userId, { kind: "notification.new", id: n.id }),
      ),
    );
    await Promise.all(
      created.map((n) =>
        sendNotificationEmail({
          to: { userId: n.userId },
          subject: `Nowe głosowanie w zadaniu: ${task.title}`,
          eyebrow: "Nowe głosowanie",
          title: task.title,
          body: `W zadaniu na tablicy ${task.board.name} pojawiło się nowe głosowanie: "${parsed.data.question}". Przejdź i oddaj głos.`,
          ctaLabel: "Przejdź do głosowania",
          ctaPath: `/w/${task.workspaceId}/t/${parsed.data.taskId}`,
        }),
      ),
    );
  }

  await writeAudit({
    workspaceId: task.workspaceId,
    objectType: "Task",
    objectId: parsed.data.taskId,
    actorId: ctx.userId,
    action: "poll.created",
    diff: { question: parsed.data.question, options: rawOptions },
  });
  revalidatePath(`/w/${task.workspaceId}/t/${parsed.data.taskId}`);
  revalidatePath("/inbox");
}

const voteSchema = z.object({
  pollId: z.string().min(1),
  optionId: z.string().min(1),
});

export async function castPollVoteAction(formData: FormData) {
  const parsed = voteSchema.safeParse({
    pollId: formData.get("pollId"),
    optionId: formData.get("optionId"),
  });
  if (!parsed.success) return;

  const poll = await db.taskPoll.findUnique({
    where: { id: parsed.data.pollId },
    include: { task: { select: { workspaceId: true, id: true } } },
  });
  if (!poll || poll.closedAt) return;

  const ctx = await requireWorkspaceAction(poll.task.workspaceId, "poll.vote");

  // Idempotent on (pollId, userId); upsert flips the vote if user already voted.
  await db.taskPollVote.upsert({
    where: { pollId_userId: { pollId: parsed.data.pollId, userId: ctx.userId } },
    update: { optionId: parsed.data.optionId, createdAt: new Date() },
    create: {
      pollId: parsed.data.pollId,
      userId: ctx.userId,
      optionId: parsed.data.optionId,
    },
  });

  revalidatePath(`/w/${poll.task.workspaceId}/t/${poll.task.id}`);
}

const closePollSchema = z.object({ pollId: z.string().min(1) });

export async function closePollAction(formData: FormData) {
  const parsed = closePollSchema.safeParse({ pollId: formData.get("pollId") });
  if (!parsed.success) return;

  const poll = await db.taskPoll.findUnique({
    where: { id: parsed.data.pollId },
    include: { task: { select: { workspaceId: true, id: true } } },
  });
  if (!poll) return;

  const ctx = await requireWorkspaceAction(poll.task.workspaceId, "poll.manage");
  // Only author or workspace admin can close.
  if (poll.authorId !== ctx.userId && ctx.role !== "ADMIN") return;

  await db.taskPoll.update({
    where: { id: parsed.data.pollId },
    data: { closedAt: new Date() },
  });
  await writeAudit({
    workspaceId: poll.task.workspaceId,
    objectType: "Task",
    objectId: poll.task.id,
    actorId: ctx.userId,
    action: "poll.closed",
  });
  revalidatePath(`/w/${poll.task.workspaceId}/t/${poll.task.id}`);
}

const deletePollSchema = z.object({ pollId: z.string().min(1) });

export async function deletePollAction(formData: FormData) {
  const parsed = deletePollSchema.safeParse({ pollId: formData.get("pollId") });
  if (!parsed.success) return;

  const poll = await db.taskPoll.findUnique({
    where: { id: parsed.data.pollId },
    include: { task: { select: { workspaceId: true, id: true } } },
  });
  if (!poll) return;

  const ctx = await requireWorkspaceAction(poll.task.workspaceId, "poll.manage");
  if (poll.authorId !== ctx.userId && ctx.role !== "ADMIN") return;

  await db.taskPoll.delete({ where: { id: parsed.data.pollId } });
  revalidatePath(`/w/${poll.task.workspaceId}/t/${poll.task.id}`);
}
