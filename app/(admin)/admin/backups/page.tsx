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
    <main className="flex-1 px-4 py-6 md:px-14 md:py-14">
      <div className="mx-auto flex max-w-6xl flex-col gap-5 md:gap-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-2">
            <span className="eyebrow">Backupy</span>
            <h1 className="font-display text-[1.5rem] font-bold leading-[1.1] tracking-[-0.03em] md:text-[2rem]">
              Dzienne kopie workspace&apos;ów
            </h1>
            <p className="max-w-[64ch] text-[0.86rem] leading-relaxed text-muted-foreground md:text-[0.92rem]">
              Cron tworzy snapshot każdego workspace&apos;u raz dziennie
              (01:00 UTC). Plik JSON zawiera całą metadatę: boardy, taski,
              briefy, support, komentarze, audit log. Możesz też ręcznie
              wymusić backup teraz.
            </p>
          </div>
        </div>

        <BackupsClient rows={rows} />
      </div>
    </main>
  );
}
