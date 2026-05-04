"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcrypt";
import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/admin-guard";
import { writeAdminAudit } from "@/lib/admin-audit";

// F12-K50: bcrypt cost 12 — zgodne z resztą apki (invite signup, password
// reset). Cost niżej = szybciej dla atakującego brute-force.
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

// F12-K50: utworz konto user'a bezposrednio z UI (bez invite flow).
// Dla super-adminow ktorzy musza dodac kogos szybko, np. testowe konto
// dla klienta. User tworzony jest aktywny, isSuperAdmin opcjonalne.
export async function createUserAction(formData: FormData): Promise<
  | { ok: true; userId: string }
  | { ok: false; error: string }
> {
  const admin = await requireSuperAdmin();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const isSuperAdmin = formData.get("isSuperAdmin") === "true";

  // Walidacja
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

  // Jeśli istnieje soft-deleted user z tym emailem — przywracamy
  // (zamiast unique constraint conflict).
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

// F12-K50: reset hasla istniejacego user'a (bez wysylki maila/invite).
// Super admin podaje nowe haslo; user dostaje je inną drogą (Slack/SMS).
// Soft-deleted users — odmawiamy resetu.
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
        // Reset 2FA — jeśli user zapomniał hasła, prawdopodobnie też
        // utracił TOTP authenticator. Super admin reset = pełny reset.
        totpSecret: null,
        totpEnabledAt: null,
      },
    }),
    // Wyloguj wszystkie aktywne sesje — nowe hasło = nowe sesje only.
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

// F12-K50: toggle super admin role. Self-toggle blocked (no orphan
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
