// Audit trail for cross-workspace super-admin operations.
//
// The regular AuditLog table FKs to Workspace, which doesn't fit
// actions like "ban user" or "force-delete workspace" — those either
// aren't scoped to one workspace, or the workspace itself is being
// destroyed (cascade would nuke the audit row). A dedicated table
// with no FK to Workspace keeps the trail durable.
//
// actorEmail is denormalised so the log survives if the actor's User
// row is later soft-deleted (email gets masked during that flow).

import { db } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";

export type AdminAuditAction =
  | "user.banned"
  | "user.unbanned"
  | "user.deleted"
  | "user.created"
  | "user.passwordReset"
  | "user.promotedToSuperAdmin"
  | "user.demotedFromSuperAdmin"
  | "users.bulk.banned"
  | "users.bulk.unbanned"
  | "users.bulk.passwordReset"
  | "users.bulk.roleChanged"
  | "workspace.forceDeleted"
  | "workspace.restored"
  | "workspace.backup.manual"
  | "workspace.backup.bulk"
  | "workspace.backup.downloaded"
  | "workspace.restore.requested"
  | "systemFlag.updated";

export type AdminAuditTargetType = "User" | "Workspace" | "SystemFlag";

export interface WriteAdminAuditInput {
  actorId: string;
  actorEmail: string;
  action: AdminAuditAction;
  targetType: AdminAuditTargetType;
  targetId: string;
  targetLabel?: string | null;
  diff?: Record<string, unknown>;
}

export async function writeAdminAudit(input: WriteAdminAuditInput): Promise<void> {
  await db.adminAuditLog.create({
    data: {
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      targetLabel: input.targetLabel ?? null,
      // Prisma's nullable-Json input wants DbNull rather than literal null
      // when we want the column to be SQL NULL (as opposed to JSON null).
      diff: input.diff
        ? (input.diff as Prisma.InputJsonValue)
        : Prisma.DbNull,
    },
  });
}
