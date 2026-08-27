import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/admin-guard";
import { BackupsClient } from "@/app/(admin)/admin/backups/backups-client";

export default async function AdminBackupsPage() {
  await requireSuperAdmin();

  // Include soft-deleted workspaces if they still have backups — history
  // remains visible after a workspace is removed.
  const workspaces = await db.workspace.findMany({
    where: {
      OR: [
        { deletedAt: null },
        { backups: { some: {} } },
      ],
    },
    orderBy: [{ deletedAt: { sort: "asc", nulls: "first" } }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      deletedAt: true,
      backups: {
        orderBy: { dayKey: "desc" },
        select: {
          id: true,
          dayKey: true,
          sizeBytes: true,
          modelCounts: true,
          createdAt: true,
        },
      },
    },
  });

  const rows = workspaces.map((w) => ({
    id: w.id,
    name: w.name,
    deletedAt: w.deletedAt ? w.deletedAt.toISOString() : null,
    backups: w.backups.map((b) => ({
      id: b.id,
      dayKey: b.dayKey,
      sizeBytes: b.sizeBytes,
      modelCounts: b.modelCounts as Record<string, number>,
      createdAt: b.createdAt.toISOString(),
    })),
  }));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2.5">
        <h1 className="text-xl font-semibold tracking-[-0.3px]">Backupy</h1>
        <span className="max-w-[70ch] text-xs text-muted-foreground">
          Cron robi snapshot każdej przestrzeni raz dziennie (01:00 UTC). JSON zawiera tablice,
          zadania, pomysły, support, komentarze i audyt. Można też wymusić backup ręcznie.
        </span>
      </div>

      <BackupsClient rows={rows} />
    </div>
  );
}
