"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { broadcastUserChange } from "@/lib/realtime";

async function currentUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

const createReminderSchema = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().max(2000).optional().or(z.literal("")),
  dueAt: z.string().min(1),
  recipientId: z.string().min(1),
});

export async function createReminderAction(formData: FormData) {
  const userId = await currentUserId();
  if (!userId) return;

  const parsed = createReminderSchema.safeParse({
    title: formData.get("title"),
    body: formData.get("body") ?? "",
    dueAt: formData.get("dueAt"),
    recipientId: formData.get("recipientId"),
  });
  if (!parsed.success) return;

  const due = new Date(parsed.data.dueAt);
  if (Number.isNaN(due.getTime())) return;

  // Recipient must share at least one workspace with us — prevents reminders to strangers.
  if (parsed.data.recipientId !== userId) {
    const shared = await db.workspaceMembership.findFirst({
      where: {
        userId: parsed.data.recipientId,
        workspace: {
          deletedAt: null,
          memberships: { some: { userId } },
        },
      },
      select: { id: true },
    });
    if (!shared) return;
  }

  const reminder = await db.personalReminder.create({
    data: {
      creatorId: userId,
      recipientId: parsed.data.recipientId,
      title: parsed.data.title,
      body: parsed.data.body || null,
      dueAt: due,
    },
    select: { id: true, recipientId: true, dueAt: true },
  });
  // If due-at already passed, broadcast immediately so ReminderPopups
  // refetches without waiting for its 20s poll.
  if (reminder.dueAt.getTime() <= Date.now()) {
    await broadcastUserChange(reminder.recipientId, {
      kind: "reminder.due",
      id: reminder.id,
    });
  }
  revalidatePath("/my/reminders");
}

const dismissSchema = z.object({ id: z.string().min(1) });

// Recipient-only: stamps dismissedAt so the popup hides for them; row stays for creator.
export async function dismissReminderAction(formData: FormData) {
  const userId = await currentUserId();
  if (!userId) return;
  const parsed = dismissSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return;
  await db.personalReminder.updateMany({
    where: { id: parsed.data.id, recipientId: userId },
    data: { dismissedAt: new Date() },
  });
  revalidatePath("/my/reminders");
}

// Creator-only permanent delete.
export async function deleteReminderAction(formData: FormData) {
  const userId = await currentUserId();
  if (!userId) return;
  const parsed = dismissSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return;
  await db.personalReminder.deleteMany({
    where: { id: parsed.data.id, creatorId: userId },
  });
  revalidatePath("/my/reminders");
}

// Creator-only edit; recipient has dismiss/snooze.
const updateReminderSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1).max(200),
  body: z.string().max(2000).optional().or(z.literal("")),
  dueAt: z.string().min(1),
  recipientId: z.string().min(1),
});

export async function updateReminderAction(formData: FormData) {
  const userId = await currentUserId();
  if (!userId) return;

  const parsed = updateReminderSchema.safeParse({
    id: formData.get("id"),
    title: formData.get("title"),
    body: formData.get("body") ?? "",
    dueAt: formData.get("dueAt"),
    recipientId: formData.get("recipientId"),
  });
  if (!parsed.success) return;

  const due = new Date(parsed.data.dueAt);
  if (Number.isNaN(due.getTime())) return;

  // Same membership guard as create — prevents re-routing to a stranger.
  if (parsed.data.recipientId !== userId) {
    const shared = await db.workspaceMembership.findFirst({
      where: {
        userId: parsed.data.recipientId,
        workspace: {
          deletedAt: null,
          memberships: { some: { userId } },
        },
      },
      select: { id: true },
    });
    if (!shared) return;
  }

  await db.personalReminder.updateMany({
    where: { id: parsed.data.id, creatorId: userId },
    data: {
      title: parsed.data.title,
      body: parsed.data.body || null,
      dueAt: due,
      recipientId: parsed.data.recipientId,
      // Clear dismissedAt so a re-armed reminder pops up again.
      dismissedAt: null,
    },
  });
  revalidatePath("/my/reminders");
}
