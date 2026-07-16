"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  requireWorkspaceAction,
  requireWorkspaceMembership,
} from "@/lib/workspace-guard";
import { ForbiddenError } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";
import {
  buildAttachmentKey,
  createSignedDownloadUrl,
  createSignedUploadUrl,
  deleteAttachmentObject,
  isAllowedMime,
  storageObjectExists,
} from "@/lib/storage";
import {
  confirmAttachmentUploadSchema,
  deleteAttachmentSchema,
  requestAttachmentUploadSchema,
} from "@/lib/schemas/attachment";

export type RequestUploadResult =
  | {
      ok: true;
      storageKey: string;
      signedUrl: string;
      token: string;
    }
  | { ok: false; error: string };

// Step 1/2: returns a short-lived signed URL + storage key. No DB row yet —
// an abandoned upload leaves no trace.
export async function requestAttachmentUploadAction(input: {
  taskId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
}): Promise<RequestUploadResult> {
  const parsed = requestAttachmentUploadSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  if (!isAllowedMime(parsed.data.mimeType)) {
    return { ok: false, error: "Nieobsługiwany typ pliku." };
  }

  const task = await db.task.findUnique({ where: { id: parsed.data.taskId } });
  if (!task || task.deletedAt) return { ok: false, error: "Zadanie nie istnieje." };

  await requireWorkspaceAction(task.workspaceId, "task.upload");

  const storageKey = buildAttachmentKey({
    workspaceId: task.workspaceId,
    taskId: task.id,
    filename: parsed.data.filename,
  });

  try {
    const { signedUrl, token } = await createSignedUploadUrl(storageKey);
    return { ok: true, storageKey, signedUrl, token };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Upload URL failed" };
  }
}

export type ConfirmUploadResult =
  | { ok: true; attachmentId: string }
  | { ok: false; error: string };

// Step 2/2: verifies the object exists in storage before persisting the
// Attachment row — prevents ghost rows from failed uploads.
export async function confirmAttachmentUploadAction(input: {
  taskId: string;
  storageKey: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
}): Promise<ConfirmUploadResult> {
  const parsed = confirmAttachmentUploadSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const task = await db.task.findUnique({ where: { id: parsed.data.taskId } });
  if (!task || task.deletedAt) return { ok: false, error: "Zadanie nie istnieje." };

  const ctx = await requireWorkspaceAction(task.workspaceId, "task.upload");

  if (!parsed.data.storageKey.startsWith(`w/${task.workspaceId}/t/${task.id}/`)) {
    // Storage key not scoped to this task — reject without touching storage.
    return { ok: false, error: "Nieprawidłowy klucz pliku." };
  }

  const exists = await storageObjectExists(parsed.data.storageKey);
  if (!exists) return { ok: false, error: "Plik nie został wgrany." };

  const attachment = await db.attachment.create({
    data: {
      taskId: task.id,
      uploaderId: ctx.userId,
      filename: parsed.data.filename,
      mimeType: parsed.data.mimeType,
      sizeBytes: parsed.data.sizeBytes,
      storageKey: parsed.data.storageKey,
    },
  });

  await writeAudit({
    workspaceId: task.workspaceId,
    objectType: "Task",
    objectId: task.id,
    actorId: ctx.userId,
    action: "attachment.created",
    diff: {
      attachmentId: attachment.id,
      filename: attachment.filename,
      sizeBytes: attachment.sizeBytes,
    },
  });

  revalidatePath(`/w/${task.workspaceId}/t/${task.id}`);
  return { ok: true, attachmentId: attachment.id };
}

export type DownloadUrlResult =
  | { ok: true; url: string; filename: string }
  | { ok: false; error: string };

// Mint a fresh 15-minute signed URL per click so copied/emailed links can't
// outlive the session. RBAC lives here, not in the URL signer.
export async function getAttachmentDownloadUrlAction(input: {
  id: string;
}): Promise<DownloadUrlResult> {
  const existing = await db.attachment.findUnique({
    where: { id: input.id },
    include: { task: { select: { id: true, workspaceId: true } } },
  });
  if (!existing || existing.deletedAt) return { ok: false, error: "Plik nie istnieje." };

  await requireWorkspaceMembership(existing.task.workspaceId);

  try {
    // F12-K134: SVG dostaje Content-Disposition: attachment (XSS mitigation —
    // otwarcie SVG jako dokument wykonuje skrypty; download nie).
    const url = await createSignedDownloadUrl(existing.storageKey, undefined, {
      forceDownload: existing.mimeType === "image/svg+xml",
    });
    return { ok: true, url, filename: existing.filename };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Download URL failed" };
  }
}

export async function deleteAttachmentAction(formData: FormData) {
  const parsed = deleteAttachmentSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return;

  const existing = await db.attachment.findUnique({
    where: { id: parsed.data.id },
    include: { task: { select: { id: true, workspaceId: true } } },
  });
  if (!existing || existing.deletedAt) return;

  const ctx = await requireWorkspaceMembership(existing.task.workspaceId);
  const canAct = existing.uploaderId === ctx.userId || ctx.role === "ADMIN";
  if (!canAct) throw new ForbiddenError("task.upload");

  await db.attachment.update({
    where: { id: existing.id },
    data: { deletedAt: new Date() },
  });

  // Best-effort storage delete; DB soft-delete is the source of truth.
  // Orphan blobs can be cleaned up later by cron and are not user-visible.
  try {
    await deleteAttachmentObject(existing.storageKey);
  } catch {
    /* swallow */
  }

  await writeAudit({
    workspaceId: existing.task.workspaceId,
    objectType: "Task",
    objectId: existing.task.id,
    actorId: ctx.userId,
    action: "attachment.deleted",
    diff: { attachmentId: existing.id, filename: existing.filename },
  });

  revalidatePath(`/w/${existing.task.workspaceId}/t/${existing.task.id}`);
}
