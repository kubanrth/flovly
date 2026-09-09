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
import { viewerCanSee } from "@/lib/access-queries";

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

/**
 * Czy obiekt istnieje, do której przestrzeni należy i kto jest jego autorem —
 * po id z formularza nie wolno ufać. `projectId` dotyczy tylko subskrypcji
 * (dostęp per projekt z F12-K141 obowiązuje dalej).
 */
type Subject = { workspaceId: string; ownerIds: (string | null)[]; projectId?: string | null };

async function subjectOf(kind: ResourceKind, id: string): Promise<Subject | null> {
  switch (kind) {
    case "SECRET": {
      const r = await db.secretItem.findUnique({ where: { id }, select: { workspaceId: true, deletedAt: true, ownerId: true } });
      return r && !r.deletedAt ? { workspaceId: r.workspaceId, ownerIds: [r.ownerId] } : null;
    }
    case "CONTACT": {
      const r = await db.contact.findUnique({ where: { id }, select: { workspaceId: true, deletedAt: true, creatorId: true, ownerId: true } });
      return r && !r.deletedAt ? { workspaceId: r.workspaceId, ownerIds: [r.creatorId, r.ownerId] } : null;
    }
    case "CANVAS": {
      const r = await db.processCanvas.findUnique({ where: { id }, select: { workspaceId: true, deletedAt: true, creatorId: true } });
      return r && !r.deletedAt ? { workspaceId: r.workspaceId, ownerIds: [r.creatorId] } : null;
    }
    case "SUBSCRIPTION": {
      const r = await db.subscription.findUnique({ where: { id }, select: { workspaceId: true, deletedAt: true, projectId: true } });
      return r && !r.deletedAt ? { workspaceId: r.workspaceId, ownerIds: [], projectId: r.projectId } : null;
    }
    case "TASK": {
      const r = await db.task.findUnique({ where: { id }, select: { workspaceId: true, deletedAt: true, creatorId: true } });
      return r && !r.deletedAt ? { workspaceId: r.workspaceId, ownerIds: [r.creatorId] } : null;
    }
    case "BOARD_VIEW": {
      const r = await db.boardView.findUnique({ where: { id }, select: { board: { select: { workspaceId: true, deletedAt: true } } } });
      return r && !r.board.deletedAt ? { workspaceId: r.board.workspaceId, ownerIds: [] } : null;
    }
  }
}

export type SetAccessResult = { ok: true; count: number } | { ok: false; error: string };

export async function setResourceAccessAction(input: { kind: ResourceKind; resourceId: string; userIds: string[] }): Promise<SetAccessResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Nieprawidłowe dane." };
  const { kind, resourceId } = parsed.data;

  const subject = await subjectOf(kind, resourceId);
  if (!subject) return { ok: false, error: "Obiekt nie istnieje." };
  const { workspaceId } = subject;
  const ctx = await requireWorkspaceAction(workspaceId, MANAGE[kind]);

  // Dostęp nadaje tylko ten, kto sam ten obiekt widzi — inaczej wystarczyłoby
  // znać id, żeby wyczyścić cudzą listę i wejść na obiekt.
  const viewer = { role: ctx.role, userId: ctx.userId };
  if (ctx.role !== "ADMIN" && subject.projectId) {
    const inProject = await db.workspaceProjectMember.findFirst({
      where: { projectId: subject.projectId, userId: ctx.userId },
      select: { userId: true },
    });
    if (!inProject) return { ok: false, error: "Brak dostępu do obiektu." };
  }
  if (!(await viewerCanSee(kind, viewer, resourceId, subject.ownerIds))) {
    return { ok: false, error: "Brak dostępu do obiektu." };
  }

  // Dostęp da się nadać tylko członkom tej przestrzeni — obce id po cichu odpadają.
  const members = parsed.data.userIds.length
    ? (await db.workspaceMembership.findMany({
        where: { workspaceId, userId: { in: parsed.data.userIds }, user: { deletedAt: null } },
        select: { userId: true },
      })).map((m) => m.userId)
    : [];

  // Bez tego można sobie samemu zamknąć drzwi: obiekt bez autora (subskrypcja,
  // widok tablicy) po zawężeniu listy zniknąłby osobie, która to ustawiła.
  if (
    members.length > 0 &&
    ctx.role !== "ADMIN" &&
    !members.includes(ctx.userId) &&
    !subject.ownerIds.includes(ctx.userId)
  ) {
    members.push(ctx.userId);
  }

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
