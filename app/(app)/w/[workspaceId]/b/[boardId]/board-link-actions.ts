"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { BoardLinkKind } from "@/lib/generated/prisma/enums";
import { requireWorkspaceAction } from "@/lib/workspace-guard";
import { writeAudit } from "@/lib/audit";

// Infers BoardLinkKind from URL host/path so the user never tags manually.
// Not exported: every export from a "use server" module must be async, and
// this is a pure sync helper. Falls back to OTHER for unknown hosts.
function detectLinkKind(url: string): BoardLinkKind {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (host.includes("docs.google.com")) {
      if (u.pathname.includes("/spreadsheets/")) return BoardLinkKind.SHEETS;
      if (u.pathname.includes("/presentation/")) return BoardLinkKind.SLIDES;
      if (u.pathname.includes("/document/")) return BoardLinkKind.DOCS;
    }
    if (host.includes("drive.google.com")) return BoardLinkKind.DRIVE;
    if (host.includes("sheets.google.com")) return BoardLinkKind.SHEETS;
    if (host.includes("slides.google.com")) return BoardLinkKind.SLIDES;
  } catch {
    /* bad URL — fall through to OTHER */
  }
  return BoardLinkKind.OTHER;
}

const createSchema = z.object({
  workspaceId: z.string().min(1),
  boardId: z.string().min(1),
  url: z.string().url().max(2048),
  label: z.string().trim().max(120).optional(),
  // Optional override; otherwise we auto-detect.
  kind: z.nativeEnum(BoardLinkKind).optional(),
});

export async function createBoardLinkAction(formData: FormData) {
  const parsed = createSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    boardId: formData.get("boardId"),
    url: formData.get("url"),
    label: formData.get("label") || undefined,
    kind: formData.get("kind") || undefined,
  });
  if (!parsed.success) return;

  const ctx = await requireWorkspaceAction(parsed.data.workspaceId, "boardLink.manage");
  const kind = parsed.data.kind ?? detectLinkKind(parsed.data.url);

  const last = await db.boardLink.findFirst({
    where: { boardId: parsed.data.boardId },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  const nextOrder = (last?.order ?? 0) + 1;

  const link = await db.boardLink.create({
    data: {
      boardId: parsed.data.boardId,
      url: parsed.data.url,
      label: parsed.data.label ?? null,
      kind,
      order: nextOrder,
    },
  });
  await writeAudit({
    workspaceId: parsed.data.workspaceId,
    objectType: "Board",
    objectId: parsed.data.boardId,
    actorId: ctx.userId,
    action: "boardLink.created",
    diff: { id: link.id, url: link.url, kind },
  });
  revalidatePath(`/w/${parsed.data.workspaceId}/b/${parsed.data.boardId}/table`);
  revalidatePath(`/w/${parsed.data.workspaceId}/b/${parsed.data.boardId}/kanban`);
  revalidatePath(`/w/${parsed.data.workspaceId}/b/${parsed.data.boardId}/roadmap`);
  revalidatePath(`/w/${parsed.data.workspaceId}/b/${parsed.data.boardId}/gantt`);
  revalidatePath(`/w/${parsed.data.workspaceId}/b/${parsed.data.boardId}/whiteboard`);
}

const deleteSchema = z.object({ id: z.string().min(1) });

export async function deleteBoardLinkAction(formData: FormData) {
  const parsed = deleteSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return;

  const link = await db.boardLink.findUnique({
    where: { id: parsed.data.id },
    include: { board: { select: { workspaceId: true, id: true } } },
  });
  if (!link) return;

  const ctx = await requireWorkspaceAction(link.board.workspaceId, "boardLink.manage");
  await db.boardLink.delete({ where: { id: parsed.data.id } });
  await writeAudit({
    workspaceId: link.board.workspaceId,
    objectType: "Board",
    objectId: link.board.id,
    actorId: ctx.userId,
    action: "boardLink.deleted",
    diff: { url: link.url },
  });
  revalidatePath(`/w/${link.board.workspaceId}/b/${link.board.id}/table`);
  revalidatePath(`/w/${link.board.workspaceId}/b/${link.board.id}/kanban`);
  revalidatePath(`/w/${link.board.workspaceId}/b/${link.board.id}/roadmap`);
  revalidatePath(`/w/${link.board.workspaceId}/b/${link.board.id}/gantt`);
  revalidatePath(`/w/${link.board.workspaceId}/b/${link.board.id}/whiteboard`);
}
