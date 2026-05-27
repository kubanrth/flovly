"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireWorkspaceAction } from "@/lib/workspace-guard";
import { writeAudit } from "@/lib/audit";

// F12-K57: zapis 'Opis ogólny' tablicy (Tiptap doc JSON). Wymaga
// board.update permission (ADMIN + MEMBER).
const updateSchema = z.object({
  workspaceId: z.string().min(1),
  boardId: z.string().min(1),
  // Loose ProseMirror — Tiptap render'uje znane node'y, drop'uje unknown.
  contentJson: z.string().min(1).max(200_000),
});

export async function updateBoardOverviewAction(formData: FormData) {
  const parsed = updateSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    boardId: formData.get("boardId"),
    contentJson: formData.get("contentJson"),
  });
  if (!parsed.success) return;

  const ctx = await requireWorkspaceAction(parsed.data.workspaceId, "board.update");

  // Sprawdź że board jest w tym workspace.
  const board = await db.board.findFirst({
    where: {
      id: parsed.data.boardId,
      workspaceId: parsed.data.workspaceId,
      deletedAt: null,
    },
    select: { id: true },
  });
  if (!board) return;

  let doc: unknown;
  try {
    doc = JSON.parse(parsed.data.contentJson);
  } catch {
    return;
  }

  await db.board.update({
    where: { id: board.id },
    data: { overviewJson: doc as object },
  });

  await writeAudit({
    workspaceId: parsed.data.workspaceId,
    objectType: "Board",
    objectId: board.id,
    actorId: ctx.userId,
    action: "board.overview.updated",
  });

  revalidatePath(`/w/${parsed.data.workspaceId}/b/${parsed.data.boardId}/overview`);
}
