"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireWorkspaceAction } from "@/lib/workspace-guard";
import { writeAudit } from "@/lib/audit";

const updateWikiSchema = z.object({
  workspaceId: z.string().min(1),
  title: z.string().trim().min(1).max(120),
  contentJson: z.string(), // stringified ProseMirror JSON
});

export async function updateWikiPageAction(formData: FormData) {
  const parsed = updateWikiSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    title: formData.get("title"),
    contentJson: formData.get("contentJson"),
  });
  if (!parsed.success) return;

  let contentJson: unknown;
  try {
    contentJson = JSON.parse(parsed.data.contentJson);
  } catch {
    return;
  }

  const ctx = await requireWorkspaceAction(parsed.data.workspaceId, "wiki.edit");

  // Upsert handles legacy workspaces that lack a WikiPage row.
  await db.wikiPage.upsert({
    where: { workspaceId: parsed.data.workspaceId },
    update: {
      title: parsed.data.title,
      contentJson: contentJson as object,
      updatedById: ctx.userId,
    },
    create: {
      workspaceId: parsed.data.workspaceId,
      title: parsed.data.title,
      contentJson: contentJson as object,
      updatedById: ctx.userId,
    },
  });

  await writeAudit({
    workspaceId: parsed.data.workspaceId,
    objectType: "Workspace",
    objectId: parsed.data.workspaceId,
    actorId: ctx.userId,
    action: "wiki.updated",
    diff: { title: parsed.data.title },
  });

  revalidatePath(`/w/${parsed.data.workspaceId}/wiki`);
}
