import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";

export type AuditObjectType =
  | "Task"
  | "Milestone"
  | "Board"
  | "Workspace"
  | "Comment"
  | "Attachment"
  | "Tag"
  | "ProcessCanvas"
  | "ProcessNode"
  | "SupportTicket"
  | "Contact"
  | "Deal"
  | "DealStage"
  | "DealActivity"
  | "TaskLink"
  | "ContactActivity"
  | "TaskLineRow"
  | "TimeEntry";

export interface WriteAuditInput {
  workspaceId: string;
  objectType: AuditObjectType;
  objectId: string;
  actorId: string | null;
  action: string;
  diff?: Prisma.InputJsonValue;
}

export async function writeAudit(input: WriteAuditInput): Promise<void> {
  await db.auditLog.create({
    data: {
      workspaceId: input.workspaceId,
      objectType: input.objectType,
      objectId: input.objectId,
      actorId: input.actorId,
      action: input.action,
      diff: input.diff ?? undefined,
    },
  });
}

export interface GlobalAuditInput {
  actorId: string | null;
  actorIp: string | null;
  endpoint: string;
  method: string;
  statusCode: number;
  errorType?: string;
  latencyMs?: number;
}

export async function writeGlobalAudit(input: GlobalAuditInput): Promise<void> {
  await db.globalAuditLog.create({
    data: {
      actorId: input.actorId,
      actorIp: input.actorIp,
      endpoint: input.endpoint,
      method: input.method,
      statusCode: input.statusCode,
      errorType: input.errorType,
      latencyMs: input.latencyMs,
    },
  });
}
