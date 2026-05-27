"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import { requireSuperAdmin } from "@/lib/admin-guard";
import { writeAdminAudit } from "@/lib/admin-audit";
import { ATTACHMENTS_BUCKET, supabaseAdmin } from "@/lib/storage";
import {
  buildWorkspaceBackup,
  polishDayKey,
} from "@/lib/workspace-backup";

const triggerSchema = z.object({ workspaceId: z.string().min(1) });

// Manual snapshot upserts the file and the WorkspaceBackup row so admins
// can force a fresh snapshot mid-day. Cron uses upsert: false for idempotency.
export async function triggerWorkspaceBackupAction(formData: FormData) {
  const session = await requireSuperAdmin();
  const parsed = triggerSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
  });
  if (!parsed.success) return;

  const ws = await db.workspace.findUnique({
    where: { id: parsed.data.workspaceId },
    select: { id: true, name: true },
  });
  if (!ws) return;

  const dayKey = polishDayKey(new Date());
  const payload = await buildWorkspaceBackup(ws.id);
  const json = JSON.stringify(payload, (_k, v) =>
    typeof v === "bigint" ? v.toString() : v,
  );
  const buf = new TextEncoder().encode(json);
  const storageKey = `w/${ws.id}/backups/${dayKey}.json`;

  const { error: uploadError } = await supabaseAdmin()
    .storage.from(ATTACHMENTS_BUCKET)
    .upload(storageKey, buf, {
      contentType: "application/json",
      upsert: true,
    });
  if (uploadError) {
    throw new Error(`Storage upload failed: ${uploadError.message}`);
  }

  await db.workspaceBackup.upsert({
    where: { workspaceId_dayKey: { workspaceId: ws.id, dayKey } },
    update: {
      storageKey,
      sizeBytes: buf.byteLength,
      modelCounts: payload.counts as Prisma.InputJsonValue,
    },
    create: {
      workspaceId: ws.id,
      dayKey,
      storageKey,
      sizeBytes: buf.byteLength,
      modelCounts: payload.counts as Prisma.InputJsonValue,
    },
  });

  await writeAdminAudit({
    actorId: session.userId,
    actorEmail: session.email,
    action: "workspace.backup.manual",
    targetType: "Workspace",
    targetId: ws.id,
    targetLabel: ws.name,
    diff: { dayKey, sizeBytes: buf.byteLength, counts: payload.counts },
  });

  revalidatePath("/admin/backups");
}

// Synchronous loop — for 10+ workspaces × MB-scale payloads this can run
// for tens of seconds. TODO: move to a background queue.
export async function triggerAllBackupsAction(): Promise<{
  ok: true;
  total: number;
  created: number;
  failed: number;
}> {
  const session = await requireSuperAdmin();
  const dayKey = polishDayKey(new Date());

  const workspaces = await db.workspace.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true },
  });

  let created = 0;
  let failed = 0;

  for (const ws of workspaces) {
    try {
      const payload = await buildWorkspaceBackup(ws.id);
      const json = JSON.stringify(payload, (_k, v) =>
        typeof v === "bigint" ? v.toString() : v,
      );
      const buf = new TextEncoder().encode(json);
      const storageKey = `w/${ws.id}/backups/${dayKey}.json`;

      const { error: uploadError } = await supabaseAdmin()
        .storage.from(ATTACHMENTS_BUCKET)
        .upload(storageKey, buf, {
          contentType: "application/json",
          upsert: true,
        });
      if (uploadError) throw uploadError;

      await db.workspaceBackup.upsert({
        where: { workspaceId_dayKey: { workspaceId: ws.id, dayKey } },
        update: {
          storageKey,
          sizeBytes: buf.byteLength,
          modelCounts: payload.counts as Prisma.InputJsonValue,
        },
        create: {
          workspaceId: ws.id,
          dayKey,
          storageKey,
          sizeBytes: buf.byteLength,
          modelCounts: payload.counts as Prisma.InputJsonValue,
        },
      });
      created++;
    } catch (e) {
      failed++;
      console.error(`[backup-bulk] workspace ${ws.id}:`, e);
    }
  }

  await writeAdminAudit({
    actorId: session.userId,
    actorEmail: session.email,
    action: "workspace.backup.bulk",
    targetType: "Workspace",
    targetId: "*",
    targetLabel: `${workspaces.length} workspaces`,
    diff: { dayKey, total: workspaces.length, created, failed },
  });

  revalidatePath("/admin/backups");
  return { ok: true, total: workspaces.length, created, failed };
}

const downloadSchema = z.object({ backupId: z.string().min(1) });

// Signed URL is minted with Content-Disposition: attachment so the browser
// saves the file under a sensible name instead of the storage key.
export async function getBackupDownloadUrlAction(input: {
  backupId: string;
}): Promise<{ ok: true; url: string; filename: string } | { ok: false; error: string }> {
  const session = await requireSuperAdmin();
  const parsed = downloadSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };

  const backup = await db.workspaceBackup.findUnique({
    where: { id: parsed.data.backupId },
    include: { workspace: { select: { name: true, id: true } } },
  });
  if (!backup) return { ok: false, error: "Backup nie istnieje." };

  const safeName = backup.workspace.name
    .replace(/[^a-zA-Z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  const filename = `${safeName || "workspace"}-${backup.dayKey}.json`;

  const { data, error } = await supabaseAdmin()
    .storage.from(ATTACHMENTS_BUCKET)
    .createSignedUrl(backup.storageKey, 900, { download: filename });
  if (error || !data) {
    return {
      ok: false,
      error: error?.message ?? "Nie udało się wygenerować linka.",
    };
  }

  await writeAdminAudit({
    actorId: session.userId,
    actorEmail: session.email,
    action: "workspace.backup.downloaded",
    targetType: "Workspace",
    targetId: backup.workspaceId,
    targetLabel: backup.workspace.name,
    diff: { backupId: backup.id, dayKey: backup.dayKey },
  });

  return { ok: true, url: data.signedUrl, filename };
}
