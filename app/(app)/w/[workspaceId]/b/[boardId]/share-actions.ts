"use server";

// F12-K79: Server actions dla public share linków tablic.
// - createShareLinkAction: generuje token + zwraca pełen URL
// - revokeShareLinkAction: soft-revoke (revokedAt set, row zostaje
//   dla audytu)
// - listShareLinksAction nie potrzebne — page.tsx prefetcha bezpośrednio

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireWorkspaceAction } from "@/lib/workspace-guard";
import { writeAudit } from "@/lib/audit";
import { generateShareToken } from "@/lib/share-token";

const createSchema = z.object({
  workspaceId: z.string().min(1),
  boardId: z.string().min(1),
  name: z.string().trim().max(80).optional(),
  // Opcjonalna ekspiracja — np. "30d" / "7d" / "" (brak limitu).
  // Rozparsowane przez klienta na ISO date; tu tylko walidujemy że ISO.
  expiresAt: z.string().datetime().optional(),
});

export type CreateShareLinkResult =
  | { ok: true; token: string; url: string }
  | { ok: false; error: string };

function buildShareUrl(token: string): string {
  // APP_BASE_URL = pełny URL produkcyjny (sprawdzane w env). Bez tego
  // wracamy do default'u, ale zwykle to admin za-config'uje przy setup'ie.
  const base = process.env.APP_BASE_URL ?? "https://flovly.pl";
  return `${base}/share/${token}`;
}

export async function createShareLinkAction(
  input: z.infer<typeof createSchema>,
): Promise<CreateShareLinkResult> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Bad input" };
  }

  const ctx = await requireWorkspaceAction(parsed.data.workspaceId, "board.share");

  // Walidacja: tablica istnieje w tym workspace'ie?
  const board = await db.board.findFirst({
    where: {
      id: parsed.data.boardId,
      workspaceId: parsed.data.workspaceId,
      deletedAt: null,
    },
    select: { id: true },
  });
  if (!board) return { ok: false, error: "Tablica nie istnieje." };

  const token = generateShareToken();

  const link = await db.boardShareLink.create({
    data: {
      workspaceId: parsed.data.workspaceId,
      boardId: parsed.data.boardId,
      token,
      name: parsed.data.name?.trim() || null,
      createdById: ctx.userId,
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
    },
    select: { id: true, token: true },
  });

  await writeAudit({
    workspaceId: parsed.data.workspaceId,
    objectType: "Board",
    objectId: parsed.data.boardId,
    actorId: ctx.userId,
    action: "board.shareCreated",
    diff: { linkId: link.id, name: parsed.data.name ?? null },
  });

  revalidatePath(`/w/${parsed.data.workspaceId}/b/${parsed.data.boardId}`);

  return { ok: true, token: link.token, url: buildShareUrl(link.token) };
}

const revokeSchema = z.object({
  linkId: z.string().min(1),
});

export async function revokeShareLinkAction(
  input: z.infer<typeof revokeSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = revokeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Bad input" };

  const link = await db.boardShareLink.findUnique({
    where: { id: parsed.data.linkId },
    select: { id: true, workspaceId: true, boardId: true, revokedAt: true },
  });
  if (!link) return { ok: false, error: "Link nie istnieje." };

  const ctx = await requireWorkspaceAction(link.workspaceId, "board.share");

  if (link.revokedAt) return { ok: true }; // idempotent

  await db.boardShareLink.update({
    where: { id: link.id },
    data: { revokedAt: new Date() },
  });

  await writeAudit({
    workspaceId: link.workspaceId,
    objectType: "Board",
    objectId: link.boardId,
    actorId: ctx.userId,
    action: "board.shareRevoked",
    diff: { linkId: link.id },
  });

  revalidatePath(`/w/${link.workspaceId}/b/${link.boardId}`);

  return { ok: true };
}
