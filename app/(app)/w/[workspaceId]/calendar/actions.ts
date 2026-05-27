"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireWorkspaceMembership } from "@/lib/workspace-guard";

// Workspace-level calendar events. Any member can create; only creator can edit/delete own.

const createSchema = z.object({
  workspaceId: z.string().min(1),
  title: z.string().trim().min(1).max(200),
  description: z.string().max(2000).optional().or(z.literal("")),
  startAt: z.string().min(1),
  endAt: z.string().min(1),
  allDay: z.string().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default("#7B68EE"),
});

export async function createWorkspaceEventAction(formData: FormData) {
  const parsed = createSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    title: formData.get("title"),
    description: formData.get("description") ?? "",
    startAt: formData.get("startAt"),
    endAt: formData.get("endAt"),
    allDay: formData.get("allDay") ?? undefined,
    color: formData.get("color") ?? "#7B68EE",
  });
  if (!parsed.success) return;

  const startAt = new Date(parsed.data.startAt);
  const endAt = new Date(parsed.data.endAt);
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) return;
  if (endAt.getTime() < startAt.getTime()) return;

  const ctx = await requireWorkspaceMembership(parsed.data.workspaceId);

  await db.workspaceEvent.create({
    data: {
      workspaceId: parsed.data.workspaceId,
      creatorId: ctx.userId,
      title: parsed.data.title,
      description: parsed.data.description || null,
      startAt,
      endAt,
      allDay: parsed.data.allDay === "on" || parsed.data.allDay === "true",
      color: parsed.data.color,
    },
  });
  revalidatePath(`/w/${parsed.data.workspaceId}/calendar`);
}

const updateSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(2000).optional().or(z.literal("")),
  startAt: z.string().min(1).optional(),
  endAt: z.string().min(1).optional(),
  allDay: z.string().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

export async function updateWorkspaceEventAction(formData: FormData) {
  const parsed = updateSchema.safeParse({
    id: formData.get("id"),
    title: formData.get("title") ?? undefined,
    description: formData.get("description") ?? undefined,
    startAt: formData.get("startAt") ?? undefined,
    endAt: formData.get("endAt") ?? undefined,
    allDay: formData.get("allDay") ?? undefined,
    color: formData.get("color") ?? undefined,
  });
  if (!parsed.success) return;

  const ev = await db.workspaceEvent.findUnique({
    where: { id: parsed.data.id },
    select: { id: true, workspaceId: true, creatorId: true },
  });
  if (!ev) return;
  const ctx = await requireWorkspaceMembership(ev.workspaceId);
  // TODO: relax to admins.
  if (ev.creatorId !== ctx.userId) return;

  const data: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) data.title = parsed.data.title;
  if (parsed.data.description !== undefined)
    data.description = parsed.data.description || null;
  if (parsed.data.startAt) {
    const d = new Date(parsed.data.startAt);
    if (!Number.isNaN(d.getTime())) data.startAt = d;
  }
  if (parsed.data.endAt) {
    const d = new Date(parsed.data.endAt);
    if (!Number.isNaN(d.getTime())) data.endAt = d;
  }
  if (parsed.data.allDay !== undefined)
    data.allDay = parsed.data.allDay === "on" || parsed.data.allDay === "true";
  if (parsed.data.color) data.color = parsed.data.color;
  if (Object.keys(data).length === 0) return;

  await db.workspaceEvent.update({ where: { id: ev.id }, data });
  revalidatePath(`/w/${ev.workspaceId}/calendar`);
}

export async function deleteWorkspaceEventAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const ev = await db.workspaceEvent.findUnique({
    where: { id },
    select: { id: true, workspaceId: true, creatorId: true },
  });
  if (!ev) return;
  const ctx = await requireWorkspaceMembership(ev.workspaceId);
  if (ev.creatorId !== ctx.userId) return;

  await db.workspaceEvent.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  revalidatePath(`/w/${ev.workspaceId}/calendar`);
}
