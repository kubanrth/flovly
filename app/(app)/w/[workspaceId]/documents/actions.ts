"use server";

// F13 „Dokumenty" — pliki przestrzeni z dostępem per osoba. Upload w dwóch
// krokach jak załączniki zadań: podpisany URL → PUT z przeglądarki → potwierdzenie
// dopiero po sprawdzeniu, że obiekt jest w storage (bez rekordów-duchów).
//
// Uprawnienia: wgrywanie, kasowanie i dostępy = `document.manage` (ADMIN, MEMBER).
// Pobranie nie ma osobnej akcji — decyduje widoczność: ADMIN widzi wszystko,
// poza tym osoba wgrywająca i osoby z listy dostępu. VIEWER pobiera tylko to,
// co mu udostępniono.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { canSeeDocument } from "@/components/documents/documents-model";
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

const buildDocumentKey = (workspaceId: string, filename: string) => buildWorkspaceFileKey(workspaceId, "doc", filename);
const keyPrefix = (workspaceId: string) => workspaceFilePrefix(workspaceId, "doc");

const fileSchema = z.object({
  workspaceId: z.string().min(1),
  filename: z.string().trim().min(1).max(255),
  mimeType: z.string().min(1).max(200),
  sizeBytes: z.number().int().positive().max(MAX_ATTACHMENT_BYTES),
});

export type RequestDocumentUploadResult =
  | { ok: true; storageKey: string; signedUrl: string }
  | { ok: false; error: string };

export async function requestDocumentUploadAction(input: {
  workspaceId: string; filename: string; mimeType: string; sizeBytes: number;
}): Promise<RequestDocumentUploadResult> {
  const parsed = fileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Nieprawidłowe dane." };
  if (!isAllowedMime(parsed.data.mimeType)) return { ok: false, error: "Nieobsługiwany typ pliku." };
  await requireWorkspaceAction(parsed.data.workspaceId, "document.manage");
  const storageKey = buildDocumentKey(parsed.data.workspaceId, parsed.data.filename);
  try {
    const { signedUrl } = await createSignedUploadUrl(storageKey);
    return { ok: true, storageKey, signedUrl };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Nie udało się przygotować uploadu." };
  }
}

export type ConfirmDocumentUploadResult = { ok: true; id: string } | { ok: false; error: string };

export async function confirmDocumentUploadAction(input: {
  workspaceId: string; storageKey: string; filename: string; mimeType: string; sizeBytes: number; accessUserIds: string[];
}): Promise<ConfirmDocumentUploadResult> {
  const parsed = fileSchema.extend({ storageKey: z.string().min(1), accessUserIds: z.array(z.string().min(1)).max(500) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Nieprawidłowe dane." };
  const { workspaceId, storageKey } = parsed.data;
  const ctx = await requireWorkspaceAction(workspaceId, "document.manage");
  // Klucz spoza tej przestrzeni — odrzucamy bez dotykania storage.
  if (!storageKey.startsWith(keyPrefix(workspaceId))) return { ok: false, error: "Nieprawidłowy klucz pliku." };
  if (!(await storageObjectExists(storageKey))) return { ok: false, error: "Plik nie został wgrany." };

  const members = await membersOf(workspaceId, parsed.data.accessUserIds);
  const doc = await db.document.create({
    data: {
      workspaceId, uploaderId: ctx.userId,
      filename: parsed.data.filename, mimeType: parsed.data.mimeType, sizeBytes: parsed.data.sizeBytes, storageKey,
      access: { create: members.map((userId) => ({ userId })) },
    },
  });
  await writeAudit({ workspaceId, objectType: "Document", objectId: doc.id, actorId: ctx.userId, action: "document.created", diff: { filename: doc.filename, sizeBytes: doc.sizeBytes, access: members } });
  revalidatePath(`/w/${workspaceId}/documents`);
  return { ok: true, id: doc.id };
}

// Dostęp da się nadać tylko członkom przestrzeni — obce id po cichu odpadają.
async function membersOf(workspaceId: string, userIds: string[]): Promise<string[]> {
  if (userIds.length === 0) return [];
  const rows = await db.workspaceMembership.findMany({ where: { workspaceId, userId: { in: userIds } }, select: { userId: true } });
  return rows.map((r) => r.userId);
}

async function visibleDocument(id: string) {
  const doc = await db.document.findUnique({ where: { id }, include: { access: { select: { userId: true } } } });
  if (!doc || doc.deletedAt) return null;
  const ctx = await requireWorkspaceMembership(doc.workspaceId);
  const visible = canSeeDocument({ role: ctx.role, userId: ctx.userId }, { uploaderId: doc.uploaderId, accessUserIds: doc.access.map((a) => a.userId) });
  return visible ? { doc, ctx } : null;
}

export type DownloadResult = { ok: true; url: string; filename: string } | { ok: false; error: string };

// Świeży 15-minutowy URL na każde kliknięcie — skopiowany link nie przeżyje sesji.
export async function getDocumentDownloadUrlAction(input: { id: string }): Promise<DownloadResult> {
  const found = await visibleDocument(String(input.id));
  if (!found) return { ok: false, error: "Nie masz dostępu do tego dokumentu." };
  try {
    // Zawsze jako pobranie: dokument ma się zapisać, nie otworzyć w karcie
    // (i SVG nie wykona skryptów).
    const url = await createSignedDownloadUrl(found.doc.storageKey, undefined, { forceDownload: true });
    return { ok: true, url, filename: found.doc.filename };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Nie udało się przygotować pobrania." };
  }
}

export async function setDocumentAccessAction(input: { id: string; userIds: string[] }): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = z.object({ id: z.string().min(1), userIds: z.array(z.string().min(1)).max(500) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Nieprawidłowe dane." };
  const doc = await db.document.findUnique({ where: { id: parsed.data.id }, select: { workspaceId: true, deletedAt: true } });
  if (!doc || doc.deletedAt) return { ok: false, error: "Dokument nie istnieje." };
  const ctx = await requireWorkspaceAction(doc.workspaceId, "document.manage");
  const members = await membersOf(doc.workspaceId, parsed.data.userIds);
  await db.$transaction([
    db.documentAccess.deleteMany({ where: { documentId: parsed.data.id } }),
    db.documentAccess.createMany({ data: members.map((userId) => ({ documentId: parsed.data.id, userId })) }),
  ]);
  await writeAudit({ workspaceId: doc.workspaceId, objectType: "Document", objectId: parsed.data.id, actorId: ctx.userId, action: "document.accessChanged", diff: { access: members } });
  revalidatePath(`/w/${doc.workspaceId}/documents`);
  return { ok: true };
}

export async function deleteDocumentAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const doc = await db.document.findUnique({ where: { id }, select: { workspaceId: true, deletedAt: true, storageKey: true, filename: true } });
  if (!doc || doc.deletedAt) return;
  const ctx = await requireWorkspaceAction(doc.workspaceId, "document.manage");
  // Rekord znika miękko, obiekt w storage — na twardo: to nie jest kosz.
  await db.document.update({ where: { id }, data: { deletedAt: new Date() } });
  await deleteAttachmentObject(doc.storageKey).catch(() => { /* rekord już oznaczony; sierota w storage nie szkodzi */ });
  await writeAudit({ workspaceId: doc.workspaceId, objectType: "Document", objectId: id, actorId: ctx.userId, action: "document.deleted", diff: { filename: doc.filename } });
  revalidatePath(`/w/${doc.workspaceId}/documents`);
}
