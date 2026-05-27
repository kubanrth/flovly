"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import { requireWorkspaceAction, requireWorkspaceMembership } from "@/lib/workspace-guard";
import { writeAudit } from "@/lib/audit";
import {
  ATTACHMENTS_BUCKET,
  MAX_ATTACHMENT_BYTES,
  createSignedUploadUrl,
  isImageMime,
  supabaseAdmin,
} from "@/lib/storage";
import { getBriefTemplate } from "@/lib/brief-templates";

// Creative brief CRUD. Create needs workspace membership;
// edit/delete = creator or workspace admin (task.update).

const createSchema = z.object({
  workspaceId: z.string().min(1),
  title: z.string().trim().min(1).max(200),
  // When provided, content/header initialise from this template instead of the default.
  templateId: z.string().min(1).optional(),
});

export async function createBriefAction(formData: FormData) {
  const parsed = createSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    title: formData.get("title"),
    templateId: formData.get("templateId") || undefined,
  });
  if (!parsed.success) return;
  const ctx = await requireWorkspaceMembership(parsed.data.workspaceId);

  // Falls back to design-brief template when no templateId is passed (legacy callers).
  const template = parsed.data.templateId
    ? getBriefTemplate(parsed.data.templateId)
    : getBriefTemplate("design-brief");

  const brief = await db.creativeBrief.create({
    data: {
      workspaceId: parsed.data.workspaceId,
      creatorId: ctx.userId,
      title: parsed.data.title,
      contentJson: template.doc as Prisma.InputJsonValue,
      emoji: template.defaultEmoji,
      headerColor: template.defaultHeaderColor,
    },
  });
  await writeAudit({
    workspaceId: parsed.data.workspaceId,
    objectType: "Workspace",
    objectId: parsed.data.workspaceId,
    actorId: ctx.userId,
    action: "creativeBrief.created",
    diff: { briefId: brief.id, title: parsed.data.title, templateId: template.id },
  });
  redirect(`/w/${parsed.data.workspaceId}/briefs/${brief.id}`);
}

const updateSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().max(200).optional(),
  contentJson: z.string().max(200_000).optional().or(z.literal("")),
  status: z.enum(["DRAFT", "IN_REVIEW", "APPROVED", "ARCHIVED"]).optional(),
  emoji: z.string().max(8).optional(),
  headerColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

export async function updateBriefAction(formData: FormData) {
  const parsed = updateSchema.safeParse({
    id: formData.get("id"),
    title: formData.get("title") ?? undefined,
    contentJson: formData.get("contentJson") ?? undefined,
    status: formData.get("status") ?? undefined,
    emoji: formData.get("emoji") ?? undefined,
    headerColor: formData.get("headerColor") ?? undefined,
  });
  if (!parsed.success) return;

  const brief = await db.creativeBrief.findUnique({
    where: { id: parsed.data.id },
    select: { id: true, workspaceId: true, creatorId: true },
  });
  if (!brief) return;
  // Creator can update own; admins (task.update) can update any.
  const ctx = await requireWorkspaceAction(brief.workspaceId, "task.update");

  const data: Prisma.CreativeBriefUncheckedUpdateInput = {};
  if (parsed.data.title !== undefined) data.title = parsed.data.title;
  if (parsed.data.contentJson !== undefined && parsed.data.contentJson !== "") {
    try {
      const doc = JSON.parse(parsed.data.contentJson);
      if (doc && typeof doc === "object") data.contentJson = doc as Prisma.InputJsonValue;
    } catch {
      /* skip */
    }
  }
  if (parsed.data.status !== undefined) data.status = parsed.data.status;
  if (parsed.data.emoji !== undefined) data.emoji = parsed.data.emoji || null;
  if (parsed.data.headerColor !== undefined) data.headerColor = parsed.data.headerColor;

  if (Object.keys(data).length === 0) return;

  await db.creativeBrief.update({ where: { id: brief.id }, data });
  await writeAudit({
    workspaceId: brief.workspaceId,
    objectType: "Workspace",
    objectId: brief.workspaceId,
    actorId: ctx.userId,
    action: "creativeBrief.updated",
    diff: { briefId: brief.id, fields: Object.keys(data) },
  });
  revalidatePath(`/w/${brief.workspaceId}/briefs/${brief.id}`);
  revalidatePath(`/w/${brief.workspaceId}/briefs`);
}

export async function deleteBriefAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const brief = await db.creativeBrief.findUnique({
    where: { id },
    select: { id: true, workspaceId: true },
  });
  if (!brief) return;
  const ctx = await requireWorkspaceAction(brief.workspaceId, "task.update");

  await db.creativeBrief.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  await writeAudit({
    workspaceId: brief.workspaceId,
    objectType: "Workspace",
    objectId: brief.workspaceId,
    actorId: ctx.userId,
    action: "creativeBrief.deleted",
    diff: { briefId: id },
  });
  redirect(`/w/${brief.workspaceId}/briefs`);
}

// Brief image upload. Client gets a signed upload URL, PUTs the file, then
// embeds <img src="/api/brief-image/<encoded-key>">. The route handler
// re-checks access on every request and 302s to a fresh signed download URL —
// avoids the embedded-URL expiry problem in contentJson.
const uploadImageSchema = z.object({
  briefId: z.string().min(1),
  filename: z.string().trim().min(1).max(200),
  contentType: z.string().min(1).max(100),
  sizeBytes: z.number().int().positive().max(MAX_ATTACHMENT_BYTES),
});

export type BriefImageUploadResult =
  | { ok: true; uploadUrl: string; storageKey: string; publicSrc: string }
  | { ok: false; error: string };

function sanitizeFilename(name: string): string {
  return (
    name
      .replace(/[\\/]/g, "_")
      .replace(/[^\w.\-]/g, "_")
      .replace(/_+/g, "_")
      .slice(-120) || "image"
  );
}

export async function requestBriefImageUploadAction(
  briefId: string,
  filename: string,
  contentType: string,
  sizeBytes: number,
): Promise<BriefImageUploadResult> {
  const parsed = uploadImageSchema.safeParse({ briefId, filename, contentType, sizeBytes });
  if (!parsed.success) {
    return { ok: false, error: "Nieprawidłowe parametry pliku." };
  }
  if (!isImageMime(parsed.data.contentType)) {
    return { ok: false, error: "Wymagany obraz (PNG / JPEG / WebP / GIF)." };
  }

  const brief = await db.creativeBrief.findFirst({
    where: { id: parsed.data.briefId, deletedAt: null },
    select: { id: true, workspaceId: true, creatorId: true },
  });
  if (!brief) return { ok: false, error: "Brief nie istnieje." };

  // Authoring permission: creator OR workspace admin (task.update).
  const ctx = await requireWorkspaceMembership(brief.workspaceId);
  const isCreator = ctx.userId === brief.creatorId;
  const isAdmin = ctx.role === "ADMIN" || ctx.role === "MEMBER";
  if (!isCreator && !isAdmin) {
    return { ok: false, error: "Brak uprawnień do edycji briefu." };
  }

  const safe = sanitizeFilename(parsed.data.filename);
  const rand = randomBytes(9).toString("base64url");
  const storageKey = `w/${brief.workspaceId}/briefs/${brief.id}/${rand}-${safe}`;

  try {
    const signed = await createSignedUploadUrl(storageKey);
    return {
      ok: true,
      uploadUrl: signed.signedUrl,
      storageKey,
      publicSrc: `/api/brief-image/${encodeURI(storageKey)}`,
    };
  } catch (err) {
    console.warn("[brief-image] signed upload failed", err);
    return { ok: false, error: "Nie udało się przygotować uploadu." };
  }
}

// Called ONLY from /api/brief-image route handler — keeps supabaseAdmin off the wire.
export async function getBriefImageDownloadUrl(
  storageKey: string,
  userId: string,
): Promise<string | null> {
  // Expected storage key form: w/<wid>/briefs/<bid>/<rand-name>
  const parts = storageKey.split("/");
  if (parts.length < 5 || parts[0] !== "w" || parts[2] !== "briefs") return null;
  const workspaceId = parts[1];
  const briefId = parts[3];

  const brief = await db.creativeBrief.findFirst({
    where: { id: briefId, workspaceId, deletedAt: null },
    select: { id: true, creatorId: true, workspaceId: true },
  });
  if (!brief) return null;

  // Briefs are workspace-wide; any member can read. No per-brief ACL.
  const membership = await db.workspaceMembership.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    select: { id: true },
  });
  if (!membership) return null;

  const { data, error } = await supabaseAdmin()
    .storage.from(ATTACHMENTS_BUCKET)
    .createSignedUrl(storageKey, 60 * 60); // 1h
  if (error || !data) return null;
  return data.signedUrl;
}
