"use server";

// F14: jedna akcja ustawiająca „kto widzi ten obiekt" dla wszystkich modułów.
// Reguła widoczności siedzi w lib/resource-access.ts (ma własny sprawdzian);
// tutaj jest tylko autoryzacja i zapis.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { requireWorkspaceAction } from "@/lib/workspace-guard";
import type { Action } from "@/lib/permissions";
import type { ResourceKind } from "@/lib/resource-access";

// Dostępem do obiektu zarządza ten, kto może ten obiekt edytować.
const MANAGE: Record<ResourceKind, Action> = {
  SECRET: "secret.manage",
  CONTACT: "contact.update",
  CANVAS: "canvas.edit",
  SUBSCRIPTION: "subscription.manage",
  TASK: "task.update",
  BOARD_VIEW: "board.update",
};

// Ścieżka modułu do odświeżenia po zmianie.
const PATH: Record<ResourceKind, (workspaceId: string) => string> = {
  SECRET: (w) => `/w/${w}/passwords`,
  CONTACT: (w) => `/w/${w}/contacts`,
  CANVAS: (w) => `/w/${w}/canvases`,
  SUBSCRIPTION: (w) => `/w/${w}/subscriptions`,
  TASK: (w) => `/w/${w}`,
  BOARD_VIEW: (w) => `/w/${w}`,
};

const kindZ = z.enum(["SECRET", "CONTACT", "CANVAS", "SUBSCRIPTION", "TASK", "BOARD_VIEW"]);
const schema = z.object({
  kind: kindZ,
  resourceId: z.string().min(1),
  userIds: z.array(z.string().min(1)).max(500),
});

/** Czy obiekt istnieje i do której przestrzeni należy — po id z formularza nie wolno ufać. */
async function workspaceOf(kind: ResourceKind, id: string): Promise<string | null> {
  switch (kind) {
    case "SECRET": {
      const r = await db.secretItem.findUnique({ where: { id }, select: { workspaceId: true, deletedAt: true } });
      return r && !r.deletedAt ? r.workspaceId : null;
    }
    case "CONTACT": {
      const r = await db.contact.findUnique({ where: { id }, select: { workspaceId: true, deletedAt: true } });
      return r && !r.deletedAt ? r.workspaceId : null;
    }
    case "CANVAS": {
      const r = await db.processCanvas.findUnique({ where: { id }, select: { workspaceId: true, deletedAt: true } });
      return r && !r.deletedAt ? r.workspaceId : null;
    }
    case "SUBSCRIPTION": {
      const r = await db.subscription.findUnique({ where: { id }, select: { workspaceId: true, deletedAt: true } });
      return r && !r.deletedAt ? r.workspaceId : null;
    }
    case "TASK": {
      const r = await db.task.findUnique({ where: { id }, select: { workspaceId: true, deletedAt: true } });
      return r && !r.deletedAt ? r.workspaceId : null;
    }
    case "BOARD_VIEW": {
      const r = await db.boardView.findUnique({ where: { id }, select: { board: { select: { workspaceId: true, deletedAt: true } } } });
      return r && !r.board.deletedAt ? r.board.workspaceId : null;
    }
  }
}

export type SetAccessResult = { ok: true; count: number } | { ok: false; error: string };

export async function setResourceAccessAction(input: { kind: ResourceKind; resourceId: string; userIds: string[] }): Promise<SetAccessResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Nieprawidłowe dane." };
  const { kind, resourceId } = parsed.data;

  const workspaceId = await workspaceOf(kind, resourceId);
  if (!workspaceId) return { ok: false, error: "Obiekt nie istnieje." };
  const ctx = await requireWorkspaceAction(workspaceId, MANAGE[kind]);

  // Dostęp da się nadać tylko członkom tej przestrzeni — obce id po cichu odpadają.
  const members = parsed.data.userIds.length
    ? (await db.workspaceMembership.findMany({
        where: { workspaceId, userId: { in: parsed.data.userIds }, user: { deletedAt: null } },
        select: { userId: true },
      })).map((m) => m.userId)
    : [];

  await db.$transaction([
    db.resourceAccess.deleteMany({ where: { kind, resourceId } }),
    db.resourceAccess.createMany({ data: members.map((userId) => ({ workspaceId, kind, resourceId, userId })) }),
  ]);
  await writeAudit({
    workspaceId, objectType: "Workspace", objectId: resourceId, actorId: ctx.userId,
    action: "access.changed", diff: { kind, access: members },
  });
  revalidatePath(PATH[kind](workspaceId));
  return { ok: true, count: members.length };
}
