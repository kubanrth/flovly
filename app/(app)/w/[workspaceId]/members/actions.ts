"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { Role } from "@/lib/generated/prisma/enums";
import {
  addBoardMemberSchema,
  cancelInviteSchema,
  changeBoardRoleSchema,
  changeRoleSchema,
  inviteSchema,
  removeBoardMemberSchema,
  removeMemberSchema,
  setBoardVisibilitySchema,
} from "@/lib/schemas/invitation";
import { requireWorkspaceAction } from "@/lib/workspace-guard";
import { writeAudit } from "@/lib/audit";
import { sendEmail } from "@/lib/email";
import { escapeHtml } from "@/lib/html-escape";
import { checkLimit } from "@/lib/rate-limit";

type FieldErrors = { email?: string; role?: string };

export type InviteState =
  | { ok: true; inviteUrl: string; emailed: boolean }
  | { ok: false; error?: string; fieldErrors?: FieldErrors }
  | null;

function tokenString(): string {
  return randomBytes(24).toString("hex");
}

export async function inviteMemberAction(
  _prev: InviteState,
  formData: FormData,
): Promise<InviteState> {
  const workspaceId = String(formData.get("workspaceId") ?? "");
  if (!workspaceId) return { ok: false, error: "Brak identyfikatora przestrzeni." };

  const ctx = await requireWorkspaceAction(workspaceId, "workspace.inviteMember");

  // Per-workspace invite limit — guards against a compromised admin spamming invites.
  const limit = await checkLimit("workspace.invite", workspaceId);
  if (!limit.ok) return { ok: false, error: limit.error };

  // Empty boardId = workspace-wide invite. Strip empty string before Zod (min(1).optional()).
  const rawBoardId = String(formData.get("boardId") ?? "").trim();
  const parsed = inviteSchema.safeParse({
    email: formData.get("email"),
    role: formData.get("role"),
    boardId: rawBoardId === "" ? undefined : rawBoardId,
  });

  if (!parsed.success) {
    const fe: FieldErrors = {};
    for (const issue of parsed.error.issues) {
      const k = issue.path[0];
      if (k === "email" || k === "role") fe[k] = issue.message;
    }
    return { ok: false, fieldErrors: fe };
  }

  const workspace = await db.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true, name: true },
  });
  if (!workspace) return { ok: false, error: "Przestrzeń nie istnieje." };

  // If board-scope, validate the board belongs to this workspace.
  let board: { id: string; name: string } | null = null;
  if (parsed.data.boardId) {
    board = await db.board.findFirst({
      where: { id: parsed.data.boardId, workspaceId, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!board) {
      return { ok: false, fieldErrors: { email: "Nieprawidłowa tablica." } };
    }
  }

  // Existing member shortcut: workspace invite bails (already has access);
  // board invite skips the email and adds BoardMembership directly.
  const existingUser = await db.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true, name: true },
  });
  if (existingUser) {
    const existingMembership = await db.workspaceMembership.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: existingUser.id } },
    });
    if (existingMembership) {
      if (!parsed.data.boardId) {
        return { ok: false, fieldErrors: { email: "Ten użytkownik już jest członkiem." } };
      }
      await db.boardMembership.upsert({
        where: {
          boardId_userId: { boardId: parsed.data.boardId, userId: existingUser.id },
        },
        update: { role: parsed.data.role },
        create: {
          boardId: parsed.data.boardId,
          userId: existingUser.id,
          role: parsed.data.role,
        },
      });
      await writeAudit({
        workspaceId,
        objectType: "Board",
        objectId: parsed.data.boardId,
        actorId: ctx.userId,
        action: "board.memberAdded",
        diff: { userId: existingUser.id, role: parsed.data.role },
      });
      revalidatePath(`/w/${workspaceId}/members`);
      return { ok: true, inviteUrl: "", emailed: false };
    }
  }

  const token = tokenString();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14); // 14 days

  // Upsert pending invite (email is unique within workspace).
  const invitation = await db.invitation.upsert({
    where: { workspaceId_email: { workspaceId, email: parsed.data.email } },
    update: {
      token,
      role: parsed.data.role,
      boardId: parsed.data.boardId ?? null,
      expiresAt,
      inviterId: ctx.userId,
      acceptedAt: null,
    },
    create: {
      workspaceId,
      boardId: parsed.data.boardId ?? null,
      email: parsed.data.email,
      role: parsed.data.role,
      token,
      expiresAt,
      inviterId: ctx.userId,
    },
  });

  const origin =
    process.env.NEXTAUTH_URL || process.env.AUTH_URL || "http://localhost:3100";
  const inviteUrl = `${origin}/invites/${token}`;

  await writeAudit({
    workspaceId,
    objectType: board ? "Board" : "Workspace",
    objectId: board ? board.id : workspaceId,
    actorId: ctx.userId,
    action: board ? "board.memberInvited" : "workspace.memberInvited",
    diff: { email: invitation.email, role: invitation.role, boardId: board?.id ?? null },
  });

  const scopeLabel = board ? `tablicy "${escapeHtml(board.name)}"` : "przestrzeni roboczej";
  const res = await sendEmail({
    to: invitation.email,
    subject: board
      ? `Zaproszenie do tablicy ${board.name} · FLOVLY`
      : `Zaproszenie do ${workspace.name} · FLOVLY`,
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:520px">
        <h1 style="font-weight:600">Jesteś zaproszona/y do ${escapeHtml(workspace.name)}</h1>
        <p>Kliknij, żeby dołączyć do ${scopeLabel}.</p>
        <p><a href="${inviteUrl}" style="display:inline-block;background:#b94a3d;color:#fff;padding:12px 20px;text-decoration:none;border-radius:4px">Akceptuj zaproszenie</a></p>
        <p style="color:#666;font-size:12px">Link wygasa w ciągu 14 dni.</p>
      </div>
    `,
  });

  revalidatePath(`/w/${workspaceId}/members`);
  return { ok: true, inviteUrl, emailed: res.sent };
}

// Adds an existing workspace user directly to a board (no email round-trip).
export async function addBoardMemberAction(formData: FormData) {
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const parsed = addBoardMemberSchema.safeParse({
    boardId: formData.get("boardId"),
    userId: formData.get("userId"),
    role: formData.get("role"),
  });
  if (!parsed.success) return;
  const ctx = await requireWorkspaceAction(workspaceId, "board.manageMembers");

  const board = await db.board.findFirst({
    where: { id: parsed.data.boardId, workspaceId, deletedAt: null },
    select: { id: true },
  });
  if (!board) return;
  const target = await db.workspaceMembership.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: parsed.data.userId } },
    select: { userId: true },
  });
  if (!target) return;

  await db.boardMembership.upsert({
    where: {
      boardId_userId: { boardId: parsed.data.boardId, userId: parsed.data.userId },
    },
    update: { role: parsed.data.role },
    create: {
      boardId: parsed.data.boardId,
      userId: parsed.data.userId,
      role: parsed.data.role,
    },
  });
  await writeAudit({
    workspaceId,
    objectType: "Board",
    objectId: parsed.data.boardId,
    actorId: ctx.userId,
    action: "board.memberAdded",
    diff: { userId: parsed.data.userId, role: parsed.data.role },
  });
  revalidatePath(`/w/${workspaceId}/members`);
  // Refresh filtered board lists — this user just got access.
  revalidatePath(`/w/[workspaceId]/b/[boardId]`, "layout");
  revalidatePath(`/w/${workspaceId}`);
}

export async function changeBoardRoleAction(formData: FormData) {
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const parsed = changeBoardRoleSchema.safeParse({
    membershipId: formData.get("membershipId"),
    role: formData.get("role"),
  });
  if (!parsed.success) return;
  const ctx = await requireWorkspaceAction(workspaceId, "board.manageMembers");

  const membership = await db.boardMembership.findUnique({
    where: { id: parsed.data.membershipId },
    include: { board: { select: { workspaceId: true, id: true } } },
  });
  if (!membership || membership.board.workspaceId !== workspaceId) return;

  await db.boardMembership.update({
    where: { id: parsed.data.membershipId },
    data: { role: parsed.data.role },
  });
  await writeAudit({
    workspaceId,
    objectType: "Board",
    objectId: membership.board.id,
    actorId: ctx.userId,
    action: "board.roleChanged",
    diff: { membershipId: parsed.data.membershipId, role: parsed.data.role },
  });
  revalidatePath(`/w/${workspaceId}/members`);
}

export async function removeBoardMemberAction(formData: FormData) {
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const parsed = removeBoardMemberSchema.safeParse({
    membershipId: formData.get("membershipId"),
  });
  if (!parsed.success) return;
  const ctx = await requireWorkspaceAction(workspaceId, "board.manageMembers");

  const membership = await db.boardMembership.findUnique({
    where: { id: parsed.data.membershipId },
    include: { board: { select: { workspaceId: true, id: true } } },
  });
  if (!membership || membership.board.workspaceId !== workspaceId) return;

  await db.boardMembership.delete({ where: { id: parsed.data.membershipId } });
  await writeAudit({
    workspaceId,
    objectType: "Board",
    objectId: membership.board.id,
    actorId: ctx.userId,
    action: "board.memberRemoved",
    diff: { membershipId: parsed.data.membershipId },
  });
  revalidatePath(`/w/${workspaceId}/members`);
  revalidatePath(`/w/[workspaceId]/b/[boardId]`, "layout");
  revalidatePath(`/w/${workspaceId}`);
}

export async function setBoardVisibilityAction(formData: FormData) {
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const parsed = setBoardVisibilitySchema.safeParse({
    boardId: formData.get("boardId"),
    visibility: formData.get("visibility"),
  });
  if (!parsed.success) return;
  const ctx = await requireWorkspaceAction(workspaceId, "board.manageMembers");

  const board = await db.board.findFirst({
    where: { id: parsed.data.boardId, workspaceId, deletedAt: null },
    select: { id: true },
  });
  if (!board) return;

  await db.board.update({
    where: { id: parsed.data.boardId },
    data: { visibility: parsed.data.visibility },
  });
  await writeAudit({
    workspaceId,
    objectType: "Board",
    objectId: parsed.data.boardId,
    actorId: ctx.userId,
    action: "board.visibilityChanged",
    diff: { visibility: parsed.data.visibility },
  });
  revalidatePath(`/w/${workspaceId}/members`);
  revalidatePath(`/w/[workspaceId]/b/[boardId]`, "layout");
  revalidatePath(`/w/${workspaceId}`);
}

export async function cancelInviteAction(formData: FormData) {
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const parsed = cancelInviteSchema.safeParse({ invitationId: formData.get("invitationId") });
  if (!parsed.success) return;
  const ctx = await requireWorkspaceAction(workspaceId, "workspace.inviteMember");
  await db.invitation.delete({ where: { id: parsed.data.invitationId } });
  await writeAudit({
    workspaceId,
    objectType: "Workspace",
    objectId: workspaceId,
    actorId: ctx.userId,
    action: "workspace.inviteCancelled",
  });
  revalidatePath(`/w/${workspaceId}/members`);
}

export async function changeRoleAction(formData: FormData) {
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const parsed = changeRoleSchema.safeParse({
    membershipId: formData.get("membershipId"),
    role: formData.get("role"),
  });
  if (!parsed.success) return;

  const ctx = await requireWorkspaceAction(workspaceId, "workspace.changeRole");
  const membership = await db.workspaceMembership.findUnique({
    where: { id: parsed.data.membershipId },
    include: { workspace: true },
  });
  if (!membership || membership.workspaceId !== workspaceId) return;

  // Don't let the sole admin demote themselves — leave at least one admin.
  if (membership.role === Role.ADMIN && parsed.data.role !== Role.ADMIN) {
    const adminCount = await db.workspaceMembership.count({
      where: { workspaceId, role: Role.ADMIN },
    });
    if (adminCount === 1) return;
  }

  await db.workspaceMembership.update({
    where: { id: parsed.data.membershipId },
    data: { role: parsed.data.role },
  });
  await writeAudit({
    workspaceId,
    objectType: "Workspace",
    objectId: workspaceId,
    actorId: ctx.userId,
    action: "workspace.roleChanged",
    diff: { membershipId: parsed.data.membershipId, role: parsed.data.role },
  });
  revalidatePath(`/w/${workspaceId}/members`);
}

export async function removeMemberAction(formData: FormData) {
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const parsed = removeMemberSchema.safeParse({ membershipId: formData.get("membershipId") });
  if (!parsed.success) return;

  const ctx = await requireWorkspaceAction(workspaceId, "workspace.removeMember");

  const membership = await db.workspaceMembership.findUnique({
    where: { id: parsed.data.membershipId },
    include: { workspace: true },
  });
  if (!membership || membership.workspaceId !== workspaceId) return;

  // Prevent removing the workspace owner.
  if (membership.userId === membership.workspace.ownerId) return;
  // Prevent removing the sole admin.
  if (membership.role === Role.ADMIN) {
    const adminCount = await db.workspaceMembership.count({
      where: { workspaceId, role: Role.ADMIN },
    });
    if (adminCount === 1) return;
  }

  await db.workspaceMembership.delete({ where: { id: parsed.data.membershipId } });
  await writeAudit({
    workspaceId,
    objectType: "Workspace",
    objectId: workspaceId,
    actorId: ctx.userId,
    action: "workspace.memberRemoved",
    diff: { membershipId: parsed.data.membershipId },
  });
  revalidatePath(`/w/${workspaceId}/members`);
}
