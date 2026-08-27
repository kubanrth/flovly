"use server";

// F12-K140: server actions modułu subskrypcji. Każdy członek workspace'u
// może edytować (prosty "Excel" firmowy — bez per-role gate'a, mirror
// password vault).

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireWorkspaceAction, requireWorkspaceMembership } from "@/lib/workspace-guard";

const CYCLES = ["MONTHLY", "YEARLY"] as const;

const createSchema = z.object({
  workspaceId: z.string().min(1),
});

// Create = pusty wiersz od razu w tabeli (Excel-style: dodajesz wiersz,
// wypełniasz inline). Zwraca id żeby klient mógł focus'ować input.
export async function createSubscriptionAction(formData: FormData): Promise<
  { ok: true; id: string } | { ok: false; error: string }
> {
  const parsed = createSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
  });
  if (!parsed.success) return { ok: false, error: "Bad request." };

  await requireWorkspaceAction(parsed.data.workspaceId, "subscription.manage");

  const row = await db.subscription.create({
    data: {
      workspaceId: parsed.data.workspaceId,
      name: "",
    },
    select: { id: true },
  });

  revalidatePath(`/w/${parsed.data.workspaceId}/subscriptions`);
  return { ok: true, id: row.id };
}

const patchSchema = z.object({
  id: z.string().min(1),
  name: z.string().max(200).optional(),
  url: z.string().max(500).optional(),
  notes: z.string().max(1000).optional(),
  // Kwota przychodzi jako string PLN ("129,99" / "129.99") — parse do groszy.
  amountPln: z.string().max(20).optional(),
  cycle: z.enum(CYCLES).optional(),
  // F12-K141: "" = odepnij projekt, id = przypnij (walidacja niżej).
  projectId: z.string().max(64).optional(),
});

export async function patchSubscriptionAction(formData: FormData) {
  const parsed = patchSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name") ?? undefined,
    url: formData.get("url") ?? undefined,
    notes: formData.get("notes") ?? undefined,
    amountPln: formData.get("amountPln") ?? undefined,
    cycle: formData.get("cycle") ?? undefined,
    projectId: formData.get("projectId") ?? undefined,
  });
  if (!parsed.success) return;

  const row = await db.subscription.findUnique({
    where: { id: parsed.data.id },
    select: { workspaceId: true, deletedAt: true },
  });
  if (!row || row.deletedAt) return;

  await requireWorkspaceAction(row.workspaceId, "subscription.manage");

  const data: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name.trim();
  if (parsed.data.url !== undefined) data.url = parsed.data.url.trim() || null;
  if (parsed.data.notes !== undefined) data.notes = parsed.data.notes.trim() || null;
  if (parsed.data.cycle !== undefined) data.cycle = parsed.data.cycle;
  if (parsed.data.amountPln !== undefined) {
    const n = Number(parsed.data.amountPln.trim().replace(",", ".").replace(/\s/g, ""));
    if (Number.isFinite(n) && n >= 0 && n <= 10_000_000) {
      data.amountCents = Math.round(n * 100);
    }
  }
  if (parsed.data.projectId !== undefined) {
    if (parsed.data.projectId === "") {
      data.projectId = null;
    } else {
      // Guard: projekt musi istnieć w TYM workspace.
      const project = await db.subscriptionProject.findFirst({
        where: { id: parsed.data.projectId, workspaceId: row.workspaceId, deletedAt: null },
        select: { id: true },
      });
      if (project) data.projectId = project.id;
    }
  }
  if (Object.keys(data).length === 0) return;

  await db.subscription.update({ where: { id: parsed.data.id }, data });
  revalidatePath(`/w/${row.workspaceId}/subscriptions`);
}

// ─── F12-K141: projekty + dostępy (zarządza workspace ADMIN) ───

const createProjectSchema = z.object({
  workspaceId: z.string().min(1),
  name: z.string().trim().min(1).max(120),
});

export async function createSubscriptionProjectAction(formData: FormData) {
  const parsed = createProjectSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    name: formData.get("name"),
  });
  if (!parsed.success) return;

  const ctx = await requireWorkspaceMembership(parsed.data.workspaceId);
  if (ctx.role !== "ADMIN") return;

  await db.subscriptionProject.create({
    data: { workspaceId: parsed.data.workspaceId, name: parsed.data.name },
  });
  revalidatePath(`/w/${parsed.data.workspaceId}/subscriptions`);
}

const toggleMemberSchema = z.object({
  projectId: z.string().min(1),
  userId: z.string().min(1),
});

export async function toggleSubscriptionProjectMemberAction(formData: FormData) {
  const parsed = toggleMemberSchema.safeParse({
    projectId: formData.get("projectId"),
    userId: formData.get("userId"),
  });
  if (!parsed.success) return;

  const project = await db.subscriptionProject.findUnique({
    where: { id: parsed.data.projectId },
    select: { workspaceId: true, deletedAt: true },
  });
  if (!project || project.deletedAt) return;

  const ctx = await requireWorkspaceMembership(project.workspaceId);
  if (ctx.role !== "ADMIN") return;

  // Grantowany user musi być członkiem workspace'u.
  const target = await db.workspaceMembership.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: project.workspaceId,
        userId: parsed.data.userId,
      },
    },
    select: { userId: true },
  });
  if (!target) return;

  const existing = await db.subscriptionProjectMember.findUnique({
    where: {
      projectId_userId: {
        projectId: parsed.data.projectId,
        userId: parsed.data.userId,
      },
    },
  });
  if (existing) {
    await db.subscriptionProjectMember.delete({
      where: {
        projectId_userId: {
          projectId: parsed.data.projectId,
          userId: parsed.data.userId,
        },
      },
    });
  } else {
    await db.subscriptionProjectMember.create({
      data: { projectId: parsed.data.projectId, userId: parsed.data.userId },
    });
  }
  revalidatePath(`/w/${project.workspaceId}/subscriptions`);
}

const deleteProjectSchema = z.object({ projectId: z.string().min(1) });

export async function deleteSubscriptionProjectAction(formData: FormData) {
  const parsed = deleteProjectSchema.safeParse({
    projectId: formData.get("projectId"),
  });
  if (!parsed.success) return;

  const project = await db.subscriptionProject.findUnique({
    where: { id: parsed.data.projectId },
    select: { workspaceId: true, deletedAt: true },
  });
  if (!project || project.deletedAt) return;

  const ctx = await requireWorkspaceMembership(project.workspaceId);
  if (ctx.role !== "ADMIN") return;

  // Soft-delete projektu + odpięcie subskrypcji (wracają do "wspólnych").
  await db.$transaction([
    db.subscription.updateMany({
      where: { projectId: parsed.data.projectId },
      data: { projectId: null },
    }),
    db.subscriptionProject.update({
      where: { id: parsed.data.projectId },
      data: { deletedAt: new Date() },
    }),
  ]);
  revalidatePath(`/w/${project.workspaceId}/subscriptions`);
}

const deleteSchema = z.object({ id: z.string().min(1) });

export async function deleteSubscriptionAction(formData: FormData) {
  const parsed = deleteSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return;

  const row = await db.subscription.findUnique({
    where: { id: parsed.data.id },
    select: { workspaceId: true, deletedAt: true },
  });
  if (!row || row.deletedAt) return;

  await requireWorkspaceAction(row.workspaceId, "subscription.manage");

  await db.subscription.update({
    where: { id: parsed.data.id },
    data: { deletedAt: new Date() },
  });
  revalidatePath(`/w/${row.workspaceId}/subscriptions`);
}
