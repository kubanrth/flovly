import Link from "next/link";
import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/admin-guard";
import { History, RotateCcw, Trash2 } from "lucide-react";
import {
  forceDeleteWorkspaceAction,
  requestWorkspaceRestoreAction,
  restoreWorkspaceAction,
} from "@/app/(admin)/admin/actions";

async function loadWorkspaces(query: string) {
  return db.workspace.findMany({
    where: query
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { slug: { contains: query, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: [{ deletedAt: { sort: "asc", nulls: "first" } }, { createdAt: "desc" }],
    take: 200,
    include: {
      owner: { select: { id: true, email: true, name: true } },
      _count: {
        select: {
          memberships: true,
          boards: { where: { deletedAt: null } },
        },
      },
    },
  });
}

type WorkspaceRow = Awaited<ReturnType<typeof loadWorkspaces>>[number];

export default async function AdminWorkspacesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireSuperAdmin();
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const workspaces = await loadWorkspaces(query);

  // Count tasks per workspace in one go — a groupBy beats N+1.
  const taskCounts = await db.task.groupBy({
    by: ["workspaceId"],
    where: { deletedAt: null },
    _count: { _all: true },
  });
  const taskCountMap = new Map(taskCounts.map((t) => [t.workspaceId, t._count._all]));

  // Storage per workspace = SUM(Attachment.sizeBytes) joined via Task.
  // Attachment FKs to Task (not Workspace directly), so we group by Task.workspaceId
  // through a raw aggregate using Prisma's groupBy on Task — we fan attachment
  // sums through their parent Task with one extra round-trip.
  // (Single $queryRaw is the cheapest path; small workspace count keeps it fine.)
  const storageRows = await db.$queryRaw<{ workspaceId: string; total: bigint }[]>`
    SELECT t."workspaceId" AS "workspaceId", COALESCE(SUM(a."sizeBytes"), 0)::bigint AS "total"
    FROM "Attachment" a
    JOIN "Task" t ON t."id" = a."taskId"
    WHERE a."deletedAt" IS NULL AND t."workspaceId" = ANY(${workspaces.map((w) => w.id)})
    GROUP BY t."workspaceId"
  `;
  const storageMap = new Map(
    storageRows.map((r) => [r.workspaceId, r.total ? Number(r.total) : 0]),
  );

  // Most-recent backup per workspace — `findMany` w/ Postgres window funcs
  // would be ideal, but Prisma can't express that; the workspace count here
  // is small (<200), so a parallel batch is fine. Cap by ordering on dayKey
  // descending so we only hold one row per workspace in memory.
  const latestBackups = await db.workspaceBackup.findMany({
    where: { workspaceId: { in: workspaces.map((w) => w.id) } },
    orderBy: [{ workspaceId: "asc" }, { dayKey: "desc" }],
    select: { workspaceId: true, dayKey: true, createdAt: true },
  });
  const backupMap = new Map<string, { dayKey: string; createdAt: Date }>();
  for (const b of latestBackups) {
    if (!backupMap.has(b.workspaceId))
      backupMap.set(b.workspaceId, { dayKey: b.dayKey, createdAt: b.createdAt });
  }

  return (
    <main className="flex-1 px-4 py-6 md:px-14 md:py-14">
      <div className="mx-auto flex max-w-6xl flex-col gap-5 md:gap-6">
        <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end md:justify-between md:gap-4">
          <div className="flex flex-col gap-2">
            <span className="eyebrow">Przestrzenie</span>
            <h1 className="font-display text-[1.5rem] font-bold leading-[1.1] tracking-[-0.03em] md:text-[2rem]">
              {workspaces.length}
            </h1>
          </div>
          <form action="/admin/workspaces" className="flex items-center gap-2">
            <input
              name="q"
              type="search"
              defaultValue={query}
              placeholder="szukaj po nazwie / slugu…"
              className="h-9 w-full rounded-md border border-border bg-card px-3 text-[0.88rem] outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40 md:w-[260px]"
            />
            <button
              type="submit"
              className="inline-flex h-9 shrink-0 items-center rounded-md border border-border bg-card px-3 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
            >
              Szukaj
            </button>
          </form>
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left">
              <thead className="border-b border-border bg-muted/50">
                <tr className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground">
                  <th className="px-4 py-2">Przestrzeń</th>
                  <th className="px-4 py-2">Właściciel</th>
                  <th className="px-4 py-2">Członków</th>
                  <th className="px-4 py-2">Tablic</th>
                  <th className="px-4 py-2">Zadań</th>
                  <th className="px-4 py-2">Storage</th>
                  <th className="px-4 py-2">Backup</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2 text-right">Akcje</th>
                </tr>
              </thead>
              <tbody>
                {workspaces.map((w) => (
                  <WorkspaceRow
                    key={w.id}
                    workspace={w}
                    taskCount={taskCountMap.get(w.id) ?? 0}
                    storageBytes={storageMap.get(w.id) ?? 0}
                    latestBackup={backupMap.get(w.id) ?? null}
                  />
                ))}
              </tbody>
            </table>
          </div>
          {workspaces.length === 0 && (
            <p className="px-4 py-8 text-center text-[0.88rem] text-muted-foreground">
              {query ? "Brak dopasowań." : "Brak przestrzeni."}
            </p>
          )}
        </div>
      </div>
    </main>
  );
}

function WorkspaceRow({
  workspace,
  taskCount,
  storageBytes,
  latestBackup,
}: {
  workspace: WorkspaceRow;
  taskCount: number;
  storageBytes: number;
  latestBackup: { dayKey: string; createdAt: Date } | null;
}) {
  const isDeleted = !!workspace.deletedAt;
  const backupAge = latestBackup ? backupAgeBucket(latestBackup.createdAt) : null;
  return (
    <tr
      data-deleted={isDeleted ? "true" : "false"}
      className="border-b border-border last:border-b-0 data-[deleted=true]:opacity-60"
    >
      <td className="px-4 py-3">
        <div className="flex flex-col">
          <Link
            href={`/w/${workspace.id}`}
            className="truncate text-[0.9rem] font-medium transition-colors hover:text-primary"
          >
            {workspace.name}
          </Link>
          <span className="truncate font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground">
            /{workspace.slug}
          </span>
        </div>
      </td>
      <td className="px-4 py-3 text-[0.82rem]">
        {workspace.owner.name ?? workspace.owner.email.split("@")[0]}
      </td>
      <td className="px-4 py-3 font-mono text-[0.78rem]">{workspace._count.memberships}</td>
      <td className="px-4 py-3 font-mono text-[0.78rem]">{workspace._count.boards}</td>
      <td className="px-4 py-3 font-mono text-[0.78rem]">{taskCount}</td>
      <td className="px-4 py-3 font-mono text-[0.78rem] text-muted-foreground">
        {formatBytes(storageBytes)}
      </td>
      <td className="px-4 py-3">
        {latestBackup ? (
          <span
            data-age={backupAge}
            className="inline-flex items-center gap-1 font-mono text-[0.7rem] uppercase tracking-[0.12em] text-muted-foreground data-[age=fresh]:text-emerald-500 data-[age=stale]:text-amber-500 data-[age=old]:text-destructive"
          >
            {formatBackupAgo(latestBackup.createdAt)}
          </span>
        ) : (
          <span className="font-mono text-[0.7rem] uppercase tracking-[0.12em] text-muted-foreground/60">
            brak
          </span>
        )}
      </td>
      <td className="px-4 py-3">
        {isDeleted ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-destructive">
            usunięta
          </span>
        ) : (
          <span className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground">
            aktywna
          </span>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          {!isDeleted && latestBackup && (
            <form action={requestWorkspaceRestoreAction} className="m-0">
              <input type="hidden" name="id" value={workspace.id} />
              <button
                type="submit"
                className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                aria-label={`Przywróć z backupu ${latestBackup.dayKey}`}
                title={`Przywróć z backupu ${latestBackup.dayKey}`}
              >
                <History size={13} />
              </button>
            </form>
          )}
          {isDeleted && (
            <form action={restoreWorkspaceAction} className="m-0">
              <input type="hidden" name="id" value={workspace.id} />
              <button
                type="submit"
                className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                aria-label="Przywróć"
                title="Przywróć"
              >
                <RotateCcw size={13} />
              </button>
            </form>
          )}
          <form action={forceDeleteWorkspaceAction} className="m-0">
            <input type="hidden" name="id" value={workspace.id} />
            <button
              type="submit"
              className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              aria-label="Skasuj na trwale"
              title="Skasuj na trwale"
            >
              <Trash2 size={13} />
            </button>
          </form>
        </div>
      </td>
    </tr>
  );
}

// Bucket backup age so the cell can colour-code itself per design ref:
// <12h fresh (emerald), <48h stale (amber), older = destructive.
function backupAgeBucket(createdAt: Date): "fresh" | "stale" | "old" {
  const ageMs = Date.now() - createdAt.getTime();
  if (ageMs < 12 * 60 * 60 * 1000) return "fresh";
  if (ageMs < 48 * 60 * 60 * 1000) return "stale";
  return "old";
}

function formatBackupAgo(createdAt: Date): string {
  const diff = Math.round((Date.now() - createdAt.getTime()) / 1000);
  if (diff < 60) return "teraz";
  if (diff < 3600) return `${Math.round(diff / 60)} min`;
  if (diff < 86400) return `${Math.round(diff / 3600)} godz.`;
  if (diff < 86400 * 7) return `${Math.round(diff / 86400)} dni`;
  return createdAt.toLocaleDateString("pl-PL");
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
