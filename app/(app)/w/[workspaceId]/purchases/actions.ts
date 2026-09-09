"use server";

// F13 „Zapotrzebowanie" — zgloszenia rzeczy do kupienia. Zglaszajacy = kto
// dodal; koszt w groszach PLN (parser i format wspolne z Subskrypcjami).

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { requireWorkspaceAction } from "@/lib/workspace-guard";
import { parseAmountPln } from "@/components/subscriptions/money";
import { MAX_LINK, normalizeLink } from "@/components/purchases/purchases-model";

const saveSchema = z.object({
  workspaceId: z.string().min(1),
  id: z.string().min(1).optional(),
  // Pusty = zgloszenie wspolne (widoczne dla calej przestrzeni).
  projectId: z.string().trim().max(60).optional(),
  link: z.string().trim().max(MAX_LINK, "Za długi link.").optional(),
  cost: z.string().trim().max(40).optional(),
});

export type SavePurchaseState =
  | { ok: true; id: string }
  | { ok: false; error?: string; fieldErrors?: { project?: string; link?: string; cost?: string } }
  | null;

export async function savePurchaseAction(_prev: SavePurchaseState, formData: FormData): Promise<SavePurchaseState> {
  const parsed = saveSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    id: formData.get("id") || undefined,
    projectId: formData.get("projectId") || undefined,
    link: formData.get("link") || undefined,
    cost: formData.get("cost") || undefined,
  });
  if (!parsed.success) {
    const fe: { project?: string; link?: string; cost?: string } = {};
    for (const i of parsed.error.issues) {
      const k = i.path[0];
      if (k === "projectId") fe.project = i.message;
      else if (k === "link" || k === "cost") fe[k] = i.message;
    }
    return { ok: false, fieldErrors: fe };
  }
  const { workspaceId, id } = parsed.data;
  const link = parsed.data.link ? normalizeLink(parsed.data.link) : null;
  if (parsed.data.link && !link) return { ok: false, fieldErrors: { link: "To nie wygląda na adres strony." } };
  let costCents: number | null = null;
  if (parsed.data.cost) {
    costCents = parseAmountPln(parsed.data.cost);
    if (costCents === null) return { ok: false, fieldErrors: { cost: "Podaj kwotę, np. 129,99." } };
  }
  const ctx = await requireWorkspaceAction(workspaceId, "purchase.manage");

  // Projekt musi byc z tej przestrzeni i zywy; nie-admin moze wybrac tylko taki,
  // do ktorego sam ma dostep — inaczej schowalby zgloszenie przed soba.
  let projectId: string | null = null;
  if (parsed.data.projectId) {
    const project = await db.workspaceProject.findFirst({
      where: {
        id: parsed.data.projectId, workspaceId, deletedAt: null,
        ...(ctx.role === "ADMIN" ? {} : { members: { some: { userId: ctx.userId } } }),
      },
      select: { id: true },
    });
    if (!project) return { ok: false, fieldErrors: { project: "Nie ma takiego projektu." } };
    projectId = project.id;
  }

  if (id) {
    const existing = await db.purchaseRequest.findUnique({ where: { id }, select: { workspaceId: true, deletedAt: true } });
    if (!existing || existing.deletedAt || existing.workspaceId !== workspaceId) return { ok: false, error: "Zgłoszenie nie istnieje." };
    await db.purchaseRequest.update({ where: { id }, data: { projectId, link, costCents } });
    await writeAudit({ workspaceId, objectType: "PurchaseRequest", objectId: id, actorId: ctx.userId, action: "purchase.updated", diff: { projectId, costCents } });
    revalidatePath(`/w/${workspaceId}/purchases`);
    return { ok: true, id };
  }
  const created = await db.purchaseRequest.create({ data: { workspaceId, requesterId: ctx.userId, projectId, link, costCents } });
  await writeAudit({ workspaceId, objectType: "PurchaseRequest", objectId: created.id, actorId: ctx.userId, action: "purchase.created", diff: { projectId, costCents } });
  revalidatePath(`/w/${workspaceId}/purchases`);
  return { ok: true, id: created.id };
}

export async function deletePurchaseAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const existing = await db.purchaseRequest.findUnique({ where: { id }, select: { workspaceId: true, deletedAt: true, projectId: true } });
  if (!existing || existing.deletedAt) return;
  const ctx = await requireWorkspaceAction(existing.workspaceId, "purchase.manage");
  await db.purchaseRequest.update({ where: { id }, data: { deletedAt: new Date() } });
  await writeAudit({ workspaceId: existing.workspaceId, objectType: "PurchaseRequest", objectId: id, actorId: ctx.userId, action: "purchase.deleted", diff: { projectId: existing.projectId } });
  revalidatePath(`/w/${existing.workspaceId}/purchases`);
}
