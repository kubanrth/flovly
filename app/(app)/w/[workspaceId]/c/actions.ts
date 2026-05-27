"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import { requireWorkspaceAction, requireWorkspaceMembership } from "@/lib/workspace-guard";
import { writeAudit } from "@/lib/audit";
import {
  ATTACHMENTS_BUCKET,
  MAX_ATTACHMENT_BYTES,
  createSignedDownloadUrl,
  createSignedUploadUrl,
  isImageMime,
  supabaseAdmin,
} from "@/lib/storage";
import {
  createCanvasSchema,
  deleteCanvasSchema,
  renameCanvasSchema,
  saveCanvasSnapshotSchema,
  type NodeSnapshotInput,
  type SaveCanvasSnapshotInput,
} from "@/lib/schemas/canvas";

// Collapses optional node metadata (reactions, locked, imagePath, textColorHex)
// into ProcessNode.dataJson. Returns DbNull when nothing non-default is set.
function nodeMeta(n: NodeSnapshotInput): Prisma.InputJsonValue | typeof Prisma.DbNull {
  const meta: Record<string, unknown> = {};
  if (n.reactions && Object.keys(n.reactions).length > 0) meta.reactions = n.reactions;
  if (n.locked) meta.locked = true;
  if (n.imagePath) meta.imagePath = n.imagePath;
  if (n.textColorHex) meta.textColorHex = n.textColorHex;
  if (Object.keys(meta).length === 0) return Prisma.DbNull;
  return meta as Prisma.InputJsonValue;
}

type CreateCanvasFieldErrors = { name?: string };

export type CreateCanvasState =
  | { ok: true; canvasId: string }
  | { ok: false; error?: string; fieldErrors?: CreateCanvasFieldErrors }
  | null;

export async function createCanvasAction(
  _prev: CreateCanvasState,
  formData: FormData,
): Promise<CreateCanvasState> {
  const parsed = createCanvasSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    name: formData.get("name"),
  });
  if (!parsed.success) {
    const fe: CreateCanvasFieldErrors = {};
    for (const issue of parsed.error.issues) {
      if (issue.path[0] === "name") fe.name = issue.message;
    }
    return { ok: false, fieldErrors: fe };
  }

  const ctx = await requireWorkspaceAction(parsed.data.workspaceId, "canvas.create");

  const canvas = await db.processCanvas.create({
    data: {
      workspaceId: parsed.data.workspaceId,
      creatorId: ctx.userId,
      name: parsed.data.name,
    },
  });

  await writeAudit({
    workspaceId: canvas.workspaceId,
    objectType: "ProcessCanvas",
    objectId: canvas.id,
    actorId: ctx.userId,
    action: "canvas.created",
    diff: { name: canvas.name },
  });

  revalidatePath(`/w/${parsed.data.workspaceId}/canvases`);
  return { ok: true, canvasId: canvas.id };
}

export async function renameCanvasAction(formData: FormData) {
  const parsed = renameCanvasSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
  });
  if (!parsed.success) return;

  const existing = await db.processCanvas.findUnique({ where: { id: parsed.data.id } });
  if (!existing || existing.deletedAt) return;

  const ctx = await requireWorkspaceAction(existing.workspaceId, "canvas.edit");

  await db.processCanvas.update({
    where: { id: parsed.data.id },
    data: { name: parsed.data.name },
  });

  await writeAudit({
    workspaceId: existing.workspaceId,
    objectType: "ProcessCanvas",
    objectId: existing.id,
    actorId: ctx.userId,
    action: "canvas.renamed",
    diff: { name: parsed.data.name },
  });

  revalidatePath(`/w/${existing.workspaceId}/canvases`);
  revalidatePath(`/w/${existing.workspaceId}/c/${existing.id}`);
}

export async function deleteCanvasAction(formData: FormData) {
  const parsed = deleteCanvasSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return;

  const existing = await db.processCanvas.findUnique({ where: { id: parsed.data.id } });
  if (!existing || existing.deletedAt) return;

  const ctx = await requireWorkspaceAction(existing.workspaceId, "canvas.delete");

  await db.processCanvas.update({
    where: { id: parsed.data.id },
    data: { deletedAt: new Date() },
  });

  await writeAudit({
    workspaceId: existing.workspaceId,
    objectType: "ProcessCanvas",
    objectId: existing.id,
    actorId: ctx.userId,
    action: "canvas.deleted",
    diff: { name: existing.name },
  });

  revalidatePath(`/w/${existing.workspaceId}/canvases`);
  redirect(`/w/${existing.workspaceId}/canvases`);
}

export type SaveSnapshotResult =
  | { ok: true; nodeCount: number; edgeCount: number }
  | { ok: false; error: string };

// Full-canvas snapshot save. Diff against existing rows so node identities
// survive across saves — critical for ProcessNodeTaskLink (onDelete: Cascade
// would nuke the links on a naive delete-and-recreate). Edges are rewritten
// since they have no downstream FKs.
export async function saveCanvasSnapshotAction(
  input: SaveCanvasSnapshotInput,
): Promise<SaveSnapshotResult> {
  const parsed = saveCanvasSnapshotSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid snapshot" };
  }

  const canvas = await db.processCanvas.findUnique({
    where: { id: parsed.data.id },
    select: { id: true, workspaceId: true, deletedAt: true },
  });
  if (!canvas || canvas.deletedAt) return { ok: false, error: "Kanwa nie istnieje." };

  const ctx = await requireWorkspaceAction(canvas.workspaceId, "canvas.edit");

  // Validate edge endpoints point at nodes in the snapshot.
  const snapshotNodeIds = new Set(parsed.data.nodes.map((n) => n.id));
  for (const e of parsed.data.edges) {
    if (!snapshotNodeIds.has(e.fromNodeId) || !snapshotNodeIds.has(e.toNodeId)) {
      return { ok: false, error: "Krawędź wskazuje na nieistniejący węzeł." };
    }
  }

  const existingNodes = await db.processNode.findMany({
    where: { canvasId: canvas.id },
    select: { id: true },
  });
  const existingNodeIds = new Set(existingNodes.map((n) => n.id));

  const toCreate = parsed.data.nodes.filter((n) => !existingNodeIds.has(n.id));
  const toUpdate = parsed.data.nodes.filter((n) => existingNodeIds.has(n.id));
  const toDelete = [...existingNodeIds].filter((id) => !snapshotNodeIds.has(id));

  await db.$transaction([
    // Drop edges first — node cascades would hit them anyway.
    db.processEdge.deleteMany({ where: { canvasId: canvas.id } }),
    // Prune nodes the client no longer has (cascades their task links).
    ...(toDelete.length > 0
      ? [db.processNode.deleteMany({ where: { canvasId: canvas.id, id: { in: toDelete } } })]
      : []),
    ...(toCreate.length > 0
      ? [
          db.processNode.createMany({
            data: toCreate.map((n) => ({
              id: n.id,
              canvasId: canvas.id,
              shape: n.shape,
              label: n.label ?? null,
              iconName: n.iconName ?? null,
              x: n.x,
              y: n.y,
              width: n.width,
              height: n.height,
              colorHex: n.colorHex,
              dataJson: nodeMeta(n),
            })),
          }),
        ]
      : []),
    // In-place updates preserve ProcessNodeTaskLink.
    ...toUpdate.map((n) =>
      db.processNode.update({
        where: { id: n.id },
        data: {
          shape: n.shape,
          label: n.label ?? null,
          iconName: n.iconName ?? null,
          x: n.x,
          y: n.y,
          width: n.width,
          height: n.height,
          colorHex: n.colorHex,
          dataJson: nodeMeta(n),
        },
      }),
    ),
    ...(parsed.data.edges.length > 0
      ? [
          db.processEdge.createMany({
            data: parsed.data.edges.map((e) => ({
              id: e.id,
              canvasId: canvas.id,
              fromNodeId: e.fromNodeId,
              toNodeId: e.toNodeId,
              label: e.label ?? null,
              style: e.style,
              endStyle: e.endStyle,
            })),
          }),
        ]
      : []),
    // Pen-tool strokes: delete-and-recreate like edges (no downstream FKs).
    db.processStroke.deleteMany({ where: { canvasId: canvas.id } }),
    ...(parsed.data.strokes && parsed.data.strokes.length > 0
      ? [
          db.processStroke.createMany({
            data: parsed.data.strokes.map((s) => ({
              id: s.id,
              canvasId: canvas.id,
              colorHex: s.colorHex,
              size: s.size,
              points: s.points,
            })),
          }),
        ]
      : []),
    db.processCanvas.update({
      where: { id: canvas.id },
      data: { updatedAt: new Date() },
    }),
  ]);

  await writeAudit({
    workspaceId: canvas.workspaceId,
    objectType: "ProcessCanvas",
    objectId: canvas.id,
    actorId: ctx.userId,
    action: "canvas.saved",
    diff: {
      nodeCount: parsed.data.nodes.length,
      edgeCount: parsed.data.edges.length,
      strokeCount: parsed.data.strokes?.length ?? 0,
      created: toCreate.length,
      updated: toUpdate.length,
      deleted: toDelete.length,
    },
  });

  // Cheap revalidate — editor holds fresh state client-side; server snapshot is page-load only.
  revalidatePath(`/w/${canvas.workspaceId}/c/${canvas.id}`);
  return { ok: true, nodeCount: parsed.data.nodes.length, edgeCount: parsed.data.edges.length };
}

export async function getCanvasSnapshotAction(id: string) {
  const canvas = await db.processCanvas.findUnique({
    where: { id },
    select: { id: true, workspaceId: true, deletedAt: true },
  });
  if (!canvas || canvas.deletedAt) return null;
  await requireWorkspaceMembership(canvas.workspaceId);
  const [nodes, edges] = await Promise.all([
    db.processNode.findMany({ where: { canvasId: id } }),
    db.processEdge.findMany({ where: { canvasId: id } }),
  ]);
  return { nodes, edges };
}

// Whiteboard image upload. Client requests signed URL → PUTs file → embeds
// imagePath in node.data.imagePath. Rendering goes through /api/canvas-image/<path>
// with signed-redirect (handler re-verifies workspace membership per request),
// so the signed URL never leaks to client JSON.
const uploadImageSchema = z.object({
  canvasId: z.string().min(1),
  filename: z.string().trim().min(1).max(200),
  contentType: z.string().min(1).max(100),
  sizeBytes: z.number().int().positive().max(MAX_ATTACHMENT_BYTES),
});

export type CanvasImageUploadResult =
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

export async function requestCanvasImageUploadAction(
  canvasId: string,
  filename: string,
  contentType: string,
  sizeBytes: number,
): Promise<CanvasImageUploadResult> {
  const parsed = uploadImageSchema.safeParse({ canvasId, filename, contentType, sizeBytes });
  if (!parsed.success) {
    return { ok: false, error: "Nieprawidłowe parametry pliku." };
  }
  if (!isImageMime(parsed.data.contentType)) {
    return { ok: false, error: "Wymagany obraz (PNG / JPEG / WebP / GIF)." };
  }

  const canvas = await db.processCanvas.findUnique({
    where: { id: parsed.data.canvasId },
    select: { id: true, workspaceId: true },
  });
  if (!canvas) return { ok: false, error: "Whiteboard nie istnieje." };

  await requireWorkspaceAction(canvas.workspaceId, "task.update");

  const safe = sanitizeFilename(parsed.data.filename);
  const rand = randomBytes(9).toString("base64url");
  const storageKey = `w/${canvas.workspaceId}/canvas/${canvas.id}/${rand}-${safe}`;

  try {
    const signed = await createSignedUploadUrl(storageKey);
    return {
      ok: true,
      uploadUrl: signed.signedUrl,
      storageKey,
      publicSrc: `/api/canvas-image/${encodeURI(storageKey)}`,
    };
  } catch (err) {
    console.warn("[canvas-image] signed upload failed", err);
    return { ok: false, error: "Nie udało się przygotować uploadu." };
  }
}

// Called ONLY from /api/canvas-image/[...path]/route.ts. Handler passes
// session.user.id; we verify storageKey belongs to a workspace the user is in.
export async function getCanvasImageDownloadUrl(
  storageKey: string,
  userId: string,
): Promise<string | null> {
  // Expected storage key form: w/<wid>/canvas/<canvasId>/<rand-name>
  const match = storageKey.match(/^w\/([^/]+)\/canvas\//);
  if (!match) return null;
  const workspaceId = match[1];

  const member = await db.workspaceMembership.findFirst({
    where: { userId, workspaceId, workspace: { deletedAt: null } },
    select: { id: true },
  });
  if (!member) return null;

  // Verify file exists in bucket before issuing a signed download URL.
  try {
    const sb = supabaseAdmin();
    const { data } = await sb.storage
      .from(ATTACHMENTS_BUCKET)
      .list(storageKey.slice(0, storageKey.lastIndexOf("/")), {
        search: storageKey.slice(storageKey.lastIndexOf("/") + 1),
      });
    if (!data || data.length === 0) return null;
    return await createSignedDownloadUrl(storageKey, 3600);
  } catch (err) {
    console.warn("[canvas-image] download URL failed", err);
    return null;
  }
}
