"use server";

// Server actions for /admin/flags — toggle system-level kill switches.
//
// `assertCan(role, …)` lives in `lib/permissions` but is workspace-scoped
// (Role enum, workspace actions). The admin namespace doesn't have a Role —
// gating runs through `requireSuperAdmin()` which redirects non-admins
// before any action body executes. That IS the admin authorisation primitive
// in this codebase.

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/admin-guard";
import { writeAdminAudit } from "@/lib/admin-audit";
import { SYSTEM_FLAGS, type SystemFlagKey } from "@/lib/system-flags";

export interface UpdateSystemFlagResult {
  ok: boolean;
  error?: string;
}

export async function updateSystemFlagAction(
  key: string,
  value: boolean,
): Promise<UpdateSystemFlagResult> {
  const admin = await requireSuperAdmin();

  // Whitelist — never let an attacker upsert arbitrary keys into SystemFlag
  // by guessing a payload. Only the five well-known kill switches are writable.
  if (!isKnownFlagKey(key)) {
    return { ok: false, error: "Nieznana flaga." };
  }
  if (typeof value !== "boolean") {
    return { ok: false, error: "Wartość musi być true/false." };
  }

  const previous = await db.systemFlag.findUnique({
    where: { key },
    select: { value: true },
  });
  const previousValue = readBool(previous?.value);

  await db.systemFlag.upsert({
    where: { key },
    update: { value, updatedBy: admin.userId },
    create: { key, value, updatedBy: admin.userId },
  });

  await writeAdminAudit({
    actorId: admin.userId,
    actorEmail: admin.email,
    action: "systemFlag.updated",
    targetType: "SystemFlag",
    targetId: key,
    targetLabel: key,
    diff: { from: previousValue, to: value },
  });

  revalidatePath("/admin/flags");
  revalidatePath("/admin/actions");

  return { ok: true };
}

function isKnownFlagKey(key: string): key is SystemFlagKey {
  return Object.prototype.hasOwnProperty.call(SYSTEM_FLAGS, key);
}

// SystemFlag.value is `Json` — boolean flags round-trip as `true`/`false`,
// but Prisma returns JsonValue so we narrow defensively.
function readBool(raw: unknown): boolean {
  if (typeof raw === "boolean") return raw;
  if (raw === "true") return true;
  return false;
}
