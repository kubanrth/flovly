"use server";

// Projekty przestrzeni — wspólne dla Subskrypcji (koszty) i Zapotrzebowania
// (zgłoszenia zakupowe). Lista osób projektu decyduje, kto widzi przypisane do
// niego wiersze; workspace ADMIN widzi i zarządza wszystkim.
//
// Zarządzanie projektami zostaje przy ADMIN-ie: to jest ustawienie dostępu, nie
// zwykła edycja danych (MEMBER może dodawać subskrypcje i zgłoszenia, ale nie
// nadawać sobie wglądu w cudze).

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireWorkspaceMembership } from "@/lib/workspace-guard";

// Projekt widać w obu narzędziach, więc obie ścieżki muszą się odświeżyć.
function revalidateProjects(workspaceId: string) {
  revalidatePath(`/w/${workspaceId}/subscriptions`);
  revalidatePath(`/w/${workspaceId}/purchases`);
}

async function requireAdmin(workspaceId: string) {
  const ctx = await requireWorkspaceMembership(workspaceId);
  return ctx.role === "ADMIN" ? ctx : null;
}

const createSchema = z.object({ workspaceId: z.string().min(1), name: z.string().trim().min(1).max(120) });

export async function createWorkspaceProjectAction(formData: FormData) {
  const parsed = createSchema.safeParse({ workspaceId: formData.get("workspaceId"), name: formData.get("name") });
  if (!parsed.success) return;
  if (!(await requireAdmin(parsed.data.workspaceId))) return;
  await db.workspaceProject.create({ data: { workspaceId: parsed.data.workspaceId, name: parsed.data.name } });
  revalidateProjects(parsed.data.workspaceId);
}

const toggleSchema = z.object({ projectId: z.string().min(1), userId: z.string().min(1) });

export async function toggleWorkspaceProjectMemberAction(formData: FormData) {
  const parsed = toggleSchema.safeParse({ projectId: formData.get("projectId"), userId: formData.get("userId") });
  if (!parsed.success) return;
  const project = await db.workspaceProject.findUnique({ where: { id: parsed.data.projectId }, select: { workspaceId: true, deletedAt: true } });
  if (!project || project.deletedAt) return;
  if (!(await requireAdmin(project.workspaceId))) return;

  // Dostęp da się nadać tylko członkowi przestrzeni.
  const target = await db.workspaceMembership.findUnique({
    where: { workspaceId_userId: { workspaceId: project.workspaceId, userId: parsed.data.userId } },
    select: { userId: true },
  });
  if (!target) return;

  const key = { projectId_userId: { projectId: parsed.data.projectId, userId: parsed.data.userId } };
  const existing = await db.workspaceProjectMember.findUnique({ where: key });
  if (existing) await db.workspaceProjectMember.delete({ where: key });
  else await db.workspaceProjectMember.create({ data: { projectId: parsed.data.projectId, userId: parsed.data.userId } });
  revalidateProjects(project.workspaceId);
}

export async function deleteWorkspaceProjectAction(formData: FormData) {
  const parsed = z.object({ projectId: z.string().min(1) }).safeParse({ projectId: formData.get("projectId") });
  if (!parsed.success) return;
  const project = await db.workspaceProject.findUnique({ where: { id: parsed.data.projectId }, select: { workspaceId: true, deletedAt: true } });
  if (!project || project.deletedAt) return;
  if (!(await requireAdmin(project.workspaceId))) return;

  // Miękkie skasowanie projektu; subskrypcje i zgłoszenia wracają do puli
  // wspólnej (nie znikają razem z nim).
  await db.$transaction([
    db.subscription.updateMany({ where: { projectId: parsed.data.projectId }, data: { projectId: null } }),
    db.purchaseRequest.updateMany({ where: { projectId: parsed.data.projectId }, data: { projectId: null } }),
    db.workspaceProject.update({ where: { id: parsed.data.projectId }, data: { deletedAt: new Date() } }),
  ]);
  revalidateProjects(project.workspaceId);
}
