"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcrypt";
import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/admin-guard";
import { writeAdminAudit } from "@/lib/admin-audit";
import type { BulkActionResult } from "./types";

// Bcrypt cost 12 — matches invite signup and password reset. Lower cost = faster brute-force.
const BCRYPT_COST = 12;

// ── Users ─────────────────────────────────────────────────────────
export async function toggleUserBanAction(formData: FormData) {
  const admin = await requireSuperAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  // Safety: never let an admin ban themselves out of the panel.
  if (id === admin.userId) return;

  const user = await db.user.findUnique({
    where: { id },
    select: { isBanned: true, email: true },
  });
  if (!user) return;

  await db.user.update({
    where: { id },
    data: { isBanned: !user.isBanned },
  });

  // Banning kills open sessions so the user's tabs get bounced at the
  // next auth callback. Unbanning leaves current sessions alone.
  if (!user.isBanned) {
    await db.session.deleteMany({ where: { userId: id } });
  }

  await writeAdminAudit({
    actorId: admin.userId,
    actorEmail: admin.email,
    action: user.isBanned ? "user.unbanned" : "user.banned",
    targetType: "User",
    targetId: id,
    targetLabel: user.email,
  });

  revalidatePath("/admin/users");
  revalidatePath("/admin");
  revalidatePath("/admin/actions");
}

export async function softDeleteUserAction(formData: FormData) {
  const admin = await requireSuperAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  if (id === admin.userId) return; // no self-delete

  const user = await db.user.findUnique({
    where: { id },
    select: { deletedAt: true, email: true },
  });
  if (!user || user.deletedAt) return;

  // Mask the email so a fresh signup can reclaim the address. We do NOT
  // hard-delete because FKs (audit entries, authored comments/tasks)
  // reference the user.
  const masked = `deleted-${id}@danielos.local`;
  await db.$transaction([
    db.user.update({
      where: { id },
      data: { deletedAt: new Date(), email: masked, isBanned: true },
    }),
    db.session.deleteMany({ where: { userId: id } }),
  ]);

  await writeAdminAudit({
    actorId: admin.userId,
    actorEmail: admin.email,
    action: "user.deleted",
    targetType: "User",
    targetId: id,
    targetLabel: user.email,
    diff: { maskedTo: masked },
  });

  revalidatePath("/admin/users");
  revalidatePath("/admin");
  revalidatePath("/admin/actions");
}

// Create user directly from UI, bypassing invite flow. User is active immediately.
export async function createUserAction(formData: FormData): Promise<
  | { ok: true; userId: string }
  | { ok: false; error: string }
> {
  const admin = await requireSuperAdmin();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const isSuperAdmin = formData.get("isSuperAdmin") === "true";

  if (!email || !email.includes("@") || email.length < 5)
    return { ok: false, error: "Niepoprawny email." };
  if (!name || name.length < 2)
    return { ok: false, error: "Imię/nazwa musi mieć min 2 znaki." };
  if (password.length < 8)
    return { ok: false, error: "Hasło musi mieć min 8 znaków." };
  if (password.length > 200)
    return { ok: false, error: "Hasło za długie (max 200)." };

  const existing = await db.user.findUnique({ where: { email } });
  if (existing && !existing.deletedAt)
    return { ok: false, error: "User z tym emailem już istnieje." };

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

  // Restore soft-deleted user with this email instead of hitting unique constraint.
  let userId: string;
  if (existing?.deletedAt) {
    const restored = await db.user.update({
      where: { id: existing.id },
      data: {
        name: name || null,
        passwordHash,
        isSuperAdmin,
        isBanned: false,
        deletedAt: null,
        totpSecret: null,
        totpEnabledAt: null,
      },
    });
    userId = restored.id;
  } else {
    const created = await db.user.create({
      data: {
        email,
        name: name || null,
        passwordHash,
        isSuperAdmin,
      },
    });
    userId = created.id;
  }

  await writeAdminAudit({
    actorId: admin.userId,
    actorEmail: admin.email,
    action: "user.created",
    targetType: "User",
    targetId: userId,
    targetLabel: email,
    diff: { isSuperAdmin },
  });

  revalidatePath("/admin/users");
  revalidatePath("/admin");
  revalidatePath("/admin/actions");

  return { ok: true, userId };
}

// Super admin sets a new password directly; user receives it out-of-band (Slack/SMS).
// Soft-deleted users are rejected — restore first.
export async function resetUserPasswordAction(formData: FormData): Promise<
  | { ok: true }
  | { ok: false; error: string }
> {
  const admin = await requireSuperAdmin();
  const id = String(formData.get("id") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!id) return { ok: false, error: "Brak ID." };
  if (password.length < 8)
    return { ok: false, error: "Hasło musi mieć min 8 znaków." };
  if (password.length > 200)
    return { ok: false, error: "Hasło za długie." };

  const user = await db.user.findUnique({
    where: { id },
    select: { email: true, deletedAt: true },
  });
  if (!user) return { ok: false, error: "User nie istnieje." };
  if (user.deletedAt)
    return { ok: false, error: "User usunięty — przywróć przed reset." };

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

  await db.$transaction([
    db.user.update({
      where: { id },
      data: {
        passwordHash,
        // Forgotten password usually means lost TOTP authenticator too — admin reset is a full reset.
        totpSecret: null,
        totpEnabledAt: null,
      },
    }),
    // Kill active sessions so the new password takes effect everywhere.
    db.session.deleteMany({ where: { userId: id } }),
  ]);

  await writeAdminAudit({
    actorId: admin.userId,
    actorEmail: admin.email,
    action: "user.passwordReset",
    targetType: "User",
    targetId: id,
    targetLabel: user.email,
  });

  revalidatePath("/admin/users");
  revalidatePath("/admin/actions");

  return { ok: true };
}

// Toggle super admin role. Self-toggle blocked (no orphan
// system without admin).
export async function toggleSuperAdminAction(formData: FormData) {
  const admin = await requireSuperAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id || id === admin.userId) return;

  const user = await db.user.findUnique({
    where: { id },
    select: { isSuperAdmin: true, email: true, deletedAt: true },
  });
  if (!user || user.deletedAt) return;

  await db.user.update({
    where: { id },
    data: { isSuperAdmin: !user.isSuperAdmin },
  });

  await writeAdminAudit({
    actorId: admin.userId,
    actorEmail: admin.email,
    action: user.isSuperAdmin ? "user.demotedFromSuperAdmin" : "user.promotedToSuperAdmin",
    targetType: "User",
    targetId: id,
    targetLabel: user.email,
  });

  revalidatePath("/admin/users");
  revalidatePath("/admin/actions");
}

// ── Bulk user actions (F7-tails: panel admin desktop) ─────────────
// Result envelope (BulkActionResult) i zero const w `./types.ts` —
// "use server" pliki mogą exportować tylko async functions w Next.js 16.

// Toggle ban on N users at once. `ban=true` blocks accounts + kills sessions;
// `ban=false` lifts the ban (sessions stay dead from the original ban).
export async function bulkToggleBanAction(
  ids: string[],
  ban: boolean,
): Promise<BulkActionResult> {
  const admin = await requireSuperAdmin();
  if (!Array.isArray(ids) || ids.length === 0)
    return { ok: false, affected: 0, error: "Brak zaznaczenia." };
  if (ids.length > 200)
    return { ok: false, affected: 0, error: "Maks 200 wierszy naraz." };

  // Filter self out — admin can never ban themselves out of the panel.
  const safeIds = ids.filter((id) => id !== admin.userId);
  if (safeIds.length === 0) return { ok: true, affected: 0 };

  const targets = await db.user.findMany({
    where: { id: { in: safeIds }, deletedAt: null },
    select: { id: true, email: true, isBanned: true },
  });
  // Only operate on users whose current state actually changes.
  const flipping = targets.filter((u) => u.isBanned !== ban);
  if (flipping.length === 0) return { ok: true, affected: 0 };

  await db.user.updateMany({
    where: { id: { in: flipping.map((u) => u.id) } },
    data: { isBanned: ban },
  });

  if (ban) {
    await db.session.deleteMany({ where: { userId: { in: flipping.map((u) => u.id) } } });
  }

  await writeAdminAudit({
    actorId: admin.userId,
    actorEmail: admin.email,
    action: ban ? "users.bulk.banned" : "users.bulk.unbanned",
    targetType: "User",
    // Bulk row in the audit trail — targetId references the batch as a synthetic
    // "bulk:<n>" id, with the full list of affected users in `diff` for forensics.
    targetId: `bulk:${flipping.length}`,
    targetLabel: `${flipping.length} kont`,
    diff: { ids: flipping.map((u) => u.id), emails: flipping.map((u) => u.email) },
  });

  revalidatePath("/admin/users");
  revalidatePath("/admin");
  revalidatePath("/admin/actions");

  return { ok: true, affected: flipping.length };
}

// Bulk promote/demote super admin. Self is filtered (admin can't strip
// themselves of the role this way; deliberate orphan-protection).
export async function bulkSetSuperAdminAction(
  ids: string[],
  isSuperAdmin: boolean,
): Promise<BulkActionResult> {
  const admin = await requireSuperAdmin();
  if (!Array.isArray(ids) || ids.length === 0)
    return { ok: false, affected: 0, error: "Brak zaznaczenia." };
  if (ids.length > 200)
    return { ok: false, affected: 0, error: "Maks 200 wierszy naraz." };

  const safeIds = ids.filter((id) => id !== admin.userId);
  if (safeIds.length === 0) return { ok: true, affected: 0 };

  const targets = await db.user.findMany({
    where: { id: { in: safeIds }, deletedAt: null },
    select: { id: true, email: true, isSuperAdmin: true },
  });
  const flipping = targets.filter((u) => u.isSuperAdmin !== isSuperAdmin);
  if (flipping.length === 0) return { ok: true, affected: 0 };

  await db.user.updateMany({
    where: { id: { in: flipping.map((u) => u.id) } },
    data: { isSuperAdmin },
  });

  await writeAdminAudit({
    actorId: admin.userId,
    actorEmail: admin.email,
    action: "users.bulk.roleChanged",
    targetType: "User",
    targetId: `bulk:${flipping.length}`,
    targetLabel: `${flipping.length} kont`,
    diff: {
      ids: flipping.map((u) => u.id),
      emails: flipping.map((u) => u.email),
      grantedSuperAdmin: isSuperAdmin,
    },
  });

  revalidatePath("/admin/users");
  revalidatePath("/admin");
  revalidatePath("/admin/actions");

  return { ok: true, affected: flipping.length };
}

// ── Workspace restore (point-in-time, soft) ───────────────────────
// "Restore" here = stage a request for the workspace to be rolled back from
// its most recent snapshot. The actual data swap is destructive + slow, so
// this action only logs intent; the cron `/api/cron/workspace-restore`
// (out of scope here) is what actually rehydrates. UI shows the request
// state via audit log.
export async function requestWorkspaceRestoreAction(formData: FormData) {
  const admin = await requireSuperAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const ws = await db.workspace.findUnique({
    where: { id },
    select: { name: true, slug: true },
  });
  if (!ws) return;

  const latestBackup = await db.workspaceBackup.findFirst({
    where: { workspaceId: id },
    orderBy: { dayKey: "desc" },
    select: { dayKey: true, sizeBytes: true },
  });

  await writeAdminAudit({
    actorId: admin.userId,
    actorEmail: admin.email,
    action: "workspace.restore.requested",
    targetType: "Workspace",
    targetId: id,
    targetLabel: `${ws.name} (/${ws.slug})`,
    diff: latestBackup
      ? { fromBackupDay: latestBackup.dayKey, sizeBytes: latestBackup.sizeBytes }
      : { fromBackupDay: null },
  });

  revalidatePath("/admin/workspaces");
  revalidatePath("/admin/actions");
}

// ── Workspaces ────────────────────────────────────────────────────
export async function forceDeleteWorkspaceAction(formData: FormData) {
  const admin = await requireSuperAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const ws = await db.workspace.findUnique({
    where: { id },
    select: { id: true, name: true, slug: true },
  });
  if (!ws) return;

  // Write audit BEFORE the delete — AdminAuditLog doesn't FK to
  // Workspace so it would survive anyway, but ordering the audit
  // first means the trail never misses an action even on a rare
  // mid-delete crash.
  await writeAdminAudit({
    actorId: admin.userId,
    actorEmail: admin.email,
    action: "workspace.forceDeleted",
    targetType: "Workspace",
    targetId: id,
    targetLabel: `${ws.name} (/${ws.slug})`,
  });

  // Hard delete — Prisma cascades handle memberships, boards, tasks,
  // comments, attachments, audit entries scoped to this workspaceId.
  await db.workspace.delete({ where: { id } });

  revalidatePath("/admin/workspaces");
  revalidatePath("/admin");
  revalidatePath("/admin/actions");
}

export async function restoreWorkspaceAction(formData: FormData) {
  const admin = await requireSuperAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const ws = await db.workspace.findUnique({
    where: { id },
    select: { deletedAt: true, name: true, slug: true },
  });
  if (!ws || !ws.deletedAt) return;

  await db.workspace.update({
    where: { id },
    data: { deletedAt: null },
  });

  await writeAdminAudit({
    actorId: admin.userId,
    actorEmail: admin.email,
    action: "workspace.restored",
    targetType: "Workspace",
    targetId: id,
    targetLabel: `${ws.name} (/${ws.slug})`,
  });

  revalidatePath("/admin/workspaces");
  revalidatePath("/admin");
  revalidatePath("/admin/actions");
}
