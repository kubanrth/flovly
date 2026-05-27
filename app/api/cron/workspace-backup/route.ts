// Vercel cron — daily workspace snapshot. Idempotent per dayKey.
// Schedule "0 1 * * *" = 01:00 UTC (02:00 CET / 03:00 CEST).

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import { ATTACHMENTS_BUCKET, supabaseAdmin } from "@/lib/storage";
import {
  buildWorkspaceBackup,
  polishDayKey,
} from "@/lib/workspace-backup";
import { isCronAuthorized } from "@/lib/cron-auth";

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const dayKey = polishDayKey(new Date());
  const workspaces = await db.workspace.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true },
  });

  let created = 0;
  let skipped = 0;
  let failed = 0;
  const errors: { workspaceId: string; error: string }[] = [];

  for (const ws of workspaces) {
    try {
      const existing = await db.workspaceBackup.findUnique({
        where: { workspaceId_dayKey: { workspaceId: ws.id, dayKey } },
        select: { id: true },
      });
      if (existing) {
        skipped++;
        continue;
      }

      const payload = await buildWorkspaceBackup(ws.id);
      // JSON.stringify nie obsługuje BigInt'ów (Workspace.storageUsedBytes).
      const json = JSON.stringify(payload, (_k, v) =>
        typeof v === "bigint" ? v.toString() : v,
      );
      const buf = new TextEncoder().encode(json);
      const storageKey = `w/${ws.id}/backups/${dayKey}.json`;

      const { error: uploadError } = await supabaseAdmin()
        .storage.from(ATTACHMENTS_BUCKET)
        .upload(storageKey, buf, {
          contentType: "application/json",
          upsert: false,
        });
      if (uploadError) throw uploadError;

      await db.workspaceBackup.create({
        data: {
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
      const msg = e instanceof Error ? e.message : String(e);
      errors.push({ workspaceId: ws.id, error: msg });
      console.error(`[backup] workspace ${ws.id}:`, msg);
    }
  }

  return NextResponse.json({
    ok: true,
    dayKey,
    total: workspaces.length,
    created,
    skipped,
    failed,
    errors,
  });
}
