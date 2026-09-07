"use server";

// F13 „Umowy" — tworzenie/edycja/kasowanie. Pola umowy przychodza z formularza
// jako rownolegle listy `label[]`/`value[]` i sa normalizowane w
// components/contracts/contracts-model.ts (ma wlasny sprawdzian).

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@/lib/generated/prisma/client";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { requireWorkspaceAction } from "@/lib/workspace-guard";
import { normalizeDetails } from "@/components/contracts/contracts-model";

const saveSchema = z.object({
  workspaceId: z.string().min(1),
  id: z.string().min(1).optional(),
  title: z.string().trim().min(1, "Podaj tytuł umowy.").max(200, "Za długi tytuł."),
});

export type SaveContractState =
  | { ok: true; id: string }
  | { ok: false; error?: string; fieldErrors?: { title?: string } }
  | null;

export async function saveContractAction(_prev: SaveContractState, formData: FormData): Promise<SaveContractState> {
  const parsed = saveSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    id: formData.get("id") || undefined,
    title: formData.get("title"),
  });
  if (!parsed.success) {
    const t = parsed.error.issues.find((i) => i.path[0] === "title");
    return { ok: false, fieldErrors: { title: t?.message ?? "Nieprawidłowe dane." } };
  }
  const { workspaceId, id, title } = parsed.data;
  const ctx = await requireWorkspaceAction(workspaceId, "contract.manage");
  // Prisma chce InputJsonValue; tablica obiektow bez sygnatury indeksowej go nie
  // spelnia typowo, choc jest poprawnym JSON-em.
  const details = normalizeDetails(
    formData.getAll("label").map(String),
    formData.getAll("value").map(String),
  ) as unknown as Prisma.InputJsonValue;

  if (id) {
    const existing = await db.contract.findUnique({ where: { id }, select: { workspaceId: true, deletedAt: true } });
    // Id z innej przestrzeni albo skasowany — nie ma czego edytowac.
    if (!existing || existing.deletedAt || existing.workspaceId !== workspaceId) return { ok: false, error: "Umowa nie istnieje." };
    await db.contract.update({ where: { id }, data: { title, details } });
    await writeAudit({ workspaceId, objectType: "Contract", objectId: id, actorId: ctx.userId, action: "contract.updated", diff: { title, fields: (details as unknown as unknown[]).length } });
    revalidatePath(`/w/${workspaceId}/contracts`);
    return { ok: true, id };
  }

  const created = await db.contract.create({ data: { workspaceId, creatorId: ctx.userId, title, details } });
  await writeAudit({ workspaceId, objectType: "Contract", objectId: created.id, actorId: ctx.userId, action: "contract.created", diff: { title, fields: (details as unknown as unknown[]).length } });
  revalidatePath(`/w/${workspaceId}/contracts`);
  return { ok: true, id: created.id };
}

export async function deleteContractAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const existing = await db.contract.findUnique({ where: { id }, select: { workspaceId: true, deletedAt: true, title: true } });
  if (!existing || existing.deletedAt) return;
  const ctx = await requireWorkspaceAction(existing.workspaceId, "contract.manage");
  await db.contract.update({ where: { id }, data: { deletedAt: new Date() } });
  await writeAudit({ workspaceId: existing.workspaceId, objectType: "Contract", objectId: id, actorId: ctx.userId, action: "contract.deleted", diff: { title: existing.title } });
  revalidatePath(`/w/${existing.workspaceId}/contracts`);
}
