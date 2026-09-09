"use server";

// F13 „Umowy" — tworzenie/edycja/kasowanie. Pola umowy przychodza z formularza
// jako rownolegle listy `label[]`/`value[]` i sa normalizowane w
// components/contracts/contracts-model.ts (ma wlasny sprawdzian).

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@/lib/generated/prisma/client";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { requireWorkspaceAction, requireWorkspaceMembership } from "@/lib/workspace-guard";
import {
  MAX_ATTACHMENT_BYTES,
  buildWorkspaceFileKey,
  createSignedDownloadUrl,
  createSignedUploadUrl,
  deleteAttachmentObject,
  isAllowedMime,
  storageObjectExists,
  workspaceFilePrefix,
} from "@/lib/storage";
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

// ─── Pliki umowy (skan/PDF) ────────────────────────────────────────────────
// Upload w dwoch krokach jak w Dokumentach i zalacznikach zadan: podpisany URL
// → PUT z przegladarki → potwierdzenie dopiero po sprawdzeniu, ze obiekt jest
// w storage. Wgrywanie i kasowanie = `contract.manage`; pobranie moze kazdy
// czlonek przestrzeni, bo umowy sa dla calej przestrzeni (jak sama karta).

const fileSchema = z.object({
  contractId: z.string().min(1),
  filename: z.string().trim().min(1).max(255),
  mimeType: z.string().min(1).max(200),
  sizeBytes: z.number().int().positive().max(MAX_ATTACHMENT_BYTES),
});

async function liveContract(id: string) {
  const c = await db.contract.findUnique({ where: { id }, select: { id: true, workspaceId: true, deletedAt: true, title: true } });
  return c && !c.deletedAt ? c : null;
}

export type RequestContractFileResult = { ok: true; storageKey: string; signedUrl: string } | { ok: false; error: string };

export async function requestContractFileUploadAction(input: {
  contractId: string; filename: string; mimeType: string; sizeBytes: number;
}): Promise<RequestContractFileResult> {
  const parsed = fileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Nieprawidłowe dane." };
  if (!isAllowedMime(parsed.data.mimeType)) return { ok: false, error: "Nieobsługiwany typ pliku." };
  const contract = await liveContract(parsed.data.contractId);
  if (!contract) return { ok: false, error: "Umowa nie istnieje." };
  await requireWorkspaceAction(contract.workspaceId, "contract.manage");
  const storageKey = buildWorkspaceFileKey(contract.workspaceId, "contract", parsed.data.filename);
  try {
    const { signedUrl } = await createSignedUploadUrl(storageKey);
    return { ok: true, storageKey, signedUrl };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Nie udało się przygotować uploadu." };
  }
}

export type ConfirmContractFileResult = { ok: true; id: string } | { ok: false; error: string };

export async function confirmContractFileUploadAction(input: {
  contractId: string; storageKey: string; filename: string; mimeType: string; sizeBytes: number;
}): Promise<ConfirmContractFileResult> {
  const parsed = fileSchema.extend({ storageKey: z.string().min(1) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Nieprawidłowe dane." };
  const contract = await liveContract(parsed.data.contractId);
  if (!contract) return { ok: false, error: "Umowa nie istnieje." };
  const ctx = await requireWorkspaceAction(contract.workspaceId, "contract.manage");
  // Klucz spoza tej przestrzeni — odrzucamy bez dotykania storage.
  if (!parsed.data.storageKey.startsWith(workspaceFilePrefix(contract.workspaceId, "contract"))) return { ok: false, error: "Nieprawidłowy klucz pliku." };
  if (!(await storageObjectExists(parsed.data.storageKey))) return { ok: false, error: "Plik nie został wgrany." };

  const file = await db.contractFile.create({
    data: {
      contractId: contract.id, uploaderId: ctx.userId, storageKey: parsed.data.storageKey,
      filename: parsed.data.filename, mimeType: parsed.data.mimeType, sizeBytes: parsed.data.sizeBytes,
    },
  });
  await writeAudit({ workspaceId: contract.workspaceId, objectType: "Contract", objectId: contract.id, actorId: ctx.userId, action: "contract.fileAdded", diff: { filename: file.filename, sizeBytes: file.sizeBytes } });
  revalidatePath(`/w/${contract.workspaceId}/contracts`);
  return { ok: true, id: file.id };
}

export type ContractFileDownload = { ok: true; url: string; filename: string } | { ok: false; error: string };

export async function getContractFileDownloadUrlAction(input: { id: string }): Promise<ContractFileDownload> {
  const file = await db.contractFile.findUnique({
    where: { id: String(input.id) },
    select: { storageKey: true, filename: true, deletedAt: true, contract: { select: { workspaceId: true, deletedAt: true } } },
  });
  if (!file || file.deletedAt || file.contract.deletedAt) return { ok: false, error: "Plik nie istnieje." };
  await requireWorkspaceMembership(file.contract.workspaceId);
  try {
    // Zawsze jako pobranie — plik ma się zapisać, nie otworzyć w karcie.
    const url = await createSignedDownloadUrl(file.storageKey, undefined, { forceDownload: true });
    return { ok: true, url, filename: file.filename };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Nie udało się przygotować pobrania." };
  }
}

export async function deleteContractFileAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const file = await db.contractFile.findUnique({
    where: { id },
    select: { storageKey: true, filename: true, deletedAt: true, contractId: true, contract: { select: { workspaceId: true } } },
  });
  if (!file || file.deletedAt) return;
  const ctx = await requireWorkspaceAction(file.contract.workspaceId, "contract.manage");
  await db.contractFile.update({ where: { id }, data: { deletedAt: new Date() } });
  await deleteAttachmentObject(file.storageKey).catch(() => { /* rekord oznaczony; sierota w storage nie szkodzi */ });
  await writeAudit({ workspaceId: file.contract.workspaceId, objectType: "Contract", objectId: file.contractId, actorId: ctx.userId, action: "contract.fileDeleted", diff: { filename: file.filename } });
  revalidatePath(`/w/${file.contract.workspaceId}/contracts`);
}
