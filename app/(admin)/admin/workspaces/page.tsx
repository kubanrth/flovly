import Link from "next/link";
import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/admin-guard";
import {
  forceDeleteWorkspaceAction,
  requestWorkspaceRestoreAction,
  restoreWorkspaceAction,
} from "@/app/(admin)/admin/actions";
import { ConfirmSubmit } from "@/components/admin/confirm-submit";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { DataFooter, DataTable, DataTd, DataTh, DataThead, DataTr } from "@/components/ui/data-table";
import { IconRecent, IconSearch, IconTrash, IconUndo } from "@/components/ui/icons";
import { InputGroup } from "@/components/ui/input";
import { plPlural } from "@/lib/pluralize";

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
      _count: { select: { memberships: true, boards: { where: { deletedAt: null } } } },
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

  // Zadania per przestrzeń jednym groupBy zamiast N+1.
  const taskCounts = await db.task.groupBy({
    by: ["workspaceId"],
    where: { deletedAt: null },
    _count: { _all: true },
  });
  const taskCountMap = new Map(taskCounts.map((t) => [t.workspaceId, t._count._all]));

  // Storage = SUM(Attachment.sizeBytes) przez Task.workspaceId — jeden przelot.
  const storageRows = await db.$queryRaw<{ workspaceId: string; total: bigint }[]>`
    SELECT t."workspaceId" AS "workspaceId", COALESCE(SUM(a."sizeBytes"), 0)::bigint AS "total"
    FROM "Attachment" a
    JOIN "Task" t ON t."id" = a."taskId"
    WHERE a."deletedAt" IS NULL AND t."workspaceId" = ANY(${workspaces.map((w) => w.id)})
    GROUP BY t."workspaceId"
  `;
  const storageMap = new Map(storageRows.map((r) => [r.workspaceId, r.total ? Number(r.total) : 0]));

  const latestBackups = await db.workspaceBackup.findMany({
    where: { workspaceId: { in: workspaces.map((w) => w.id) } },
    orderBy: [{ workspaceId: "asc" }, { dayKey: "desc" }],
    select: { workspaceId: true, dayKey: true, createdAt: true },
  });
  const backupMap = new Map<string, { dayKey: string; createdAt: Date }>();
  for (const b of latestBackups) {
    if (!backupMap.has(b.workspaceId)) backupMap.set(b.workspaceId, { dayKey: b.dayKey, createdAt: b.createdAt });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2.5">
        <h1 className="text-xl font-semibold tracking-[-0.3px]">Przestrzenie</h1>
        <span className="font-mono text-xs text-muted-foreground">
          {workspaces.length} {plPlural(workspaces.length, "przestrzeń", "przestrzenie", "przestrzeni")}
        </span>
        <span className="flex-1" />
        <form action="/admin/workspaces" className="flex items-center gap-2">
          <InputGroup
            name="q"
            type="search"
            defaultValue={query}
            placeholder="Szukaj po nazwie lub slugu…"
            aria-label="Szukaj przestrzeni"
            leading={<IconSearch width={13} height={13} />}
            className="md:w-[260px]"
          />
          <Button type="submit" variant="secondary">
            Szukaj
          </Button>
        </form>
      </div>

      <DataTable
        className="[--row-h:44px] min-w-[900px]"
        footer={
          <DataFooter>
            {workspaces.length} {plPlural(workspaces.length, "wiersz", "wiersze", "wierszy")}
            {workspaces.length === 200 && " · pokazane pierwsze 200"}
          </DataFooter>
        }
      >
        <DataThead>
          <tr>
            <DataTh>Przestrzeń</DataTh>
            <DataTh width={160}>Właściciel</DataTh>
            <DataTh width={90} align="right">Członków</DataTh>
            <DataTh width={80} align="right">Tablic</DataTh>
            <DataTh width={80} align="right">Zadań</DataTh>
            <DataTh width={90} align="right">Storage</DataTh>
            <DataTh width={100}>Backup</DataTh>
            <DataTh width={100}>Status</DataTh>
            <DataTh width={110} align="right">Akcje</DataTh>
          </tr>
        </DataThead>
        <tbody>
          {workspaces.map((w) => (
            <WorkspaceTableRow
              key={w.id}
              workspace={w}
              taskCount={taskCountMap.get(w.id) ?? 0}
              storageBytes={storageMap.get(w.id) ?? 0}
              latestBackup={backupMap.get(w.id) ?? null}
            />
          ))}
          {workspaces.length === 0 && (
            <tr>
              <td colSpan={9} className="px-2.5 py-10 text-center text-sm text-muted-foreground">
                {query ? "Brak dopasowań." : "Brak przestrzeni."}
              </td>
            </tr>
          )}
        </tbody>
      </DataTable>
    </div>
  );
}

function WorkspaceTableRow({
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
  return (
    <DataTr className={isDeleted ? "opacity-60" : undefined}>
      <DataTd>
        <span className="flex min-w-0 flex-col leading-tight">
          <Link
            href={`/w/${workspace.id}`}
            className="truncate text-sm font-medium text-foreground outline-none hover:text-orange-800 hover:underline"
          >
            {workspace.name}
          </Link>
          <span className="truncate font-mono text-2xs text-fg-3">/{workspace.slug}</span>
        </span>
      </DataTd>
      <DataTd className="truncate text-xs">
        {workspace.owner.name ?? workspace.owner.email.split("@")[0]}
      </DataTd>
      <DataTd align="right" className="font-mono text-xs">{workspace._count.memberships}</DataTd>
      <DataTd align="right" className="font-mono text-xs">{workspace._count.boards}</DataTd>
      <DataTd align="right" className="font-mono text-xs">{taskCount}</DataTd>
      <DataTd align="right" className="font-mono text-xs text-muted-foreground">{formatBytes(storageBytes)}</DataTd>
      <DataTd>
        {latestBackup ? (
          <BackupAge createdAt={latestBackup.createdAt} />
        ) : (
          <span className="font-mono text-2xs text-fg-3">brak</span>
        )}
      </DataTd>
      <DataTd>
        {isDeleted ? <Chip hue="red" size="sm">usunięta</Chip> : <Chip hue="green" dot size="sm">aktywna</Chip>}
      </DataTd>
      <DataTd align="right">
        <span className="flex items-center justify-end gap-0.5">
          {!isDeleted && latestBackup && (
            <form action={requestWorkspaceRestoreAction} className="m-0">
              <input type="hidden" name="id" value={workspace.id} />
              <ConfirmSubmit
                label={`Przywróć z backupu ${latestBackup.dayKey}`}
                confirmMessage={`Przywrócić przestrzeń „${workspace.name}" z backupu ${latestBackup.dayKey}?`}
              >
                <IconRecent width={14} height={14} />
              </ConfirmSubmit>
            </form>
          )}
          {isDeleted && (
            <form action={restoreWorkspaceAction} className="m-0">
              <input type="hidden" name="id" value={workspace.id} />
              <ConfirmSubmit
                label="Przywróć przestrzeń"
                confirmMessage={`Przywrócić przestrzeń „${workspace.name}"?`}
              >
                <IconUndo width={14} height={14} />
              </ConfirmSubmit>
            </form>
          )}
          <form action={forceDeleteWorkspaceAction} className="m-0">
            <input type="hidden" name="id" value={workspace.id} />
            <ConfirmSubmit
              label="Skasuj na trwałe"
              destructive
              confirmMessage={`Skasować przestrzeń „${workspace.name}" NA TRWAŁE? Tego nie da się cofnąć.`}
            >
              <IconTrash width={14} height={14} />
            </ConfirmSubmit>
          </form>
        </span>
      </DataTd>
    </DataTr>
  );
}

// Wiek backupu: <12 h świeży, <48 h przeterminowany, dalej alarm.
function BackupAge({ createdAt }: { createdAt: Date }) {
  // Serwerowy render — „teraz" to migawka żądania, nie nieczystość komponentu.
  // eslint-disable-next-line react-hooks/purity
  const ageMs = Date.now() - createdAt.getTime();
  const hue = ageMs < 12 * 3600_000 ? "green" : ageMs < 48 * 3600_000 ? "yellow" : "red";
  const diff = Math.round(ageMs / 1000);
  const label =
    diff < 60 ? "teraz"
    : diff < 3600 ? `${Math.round(diff / 60)} min`
    : diff < 86400 ? `${Math.round(diff / 3600)} godz.`
    : diff < 86400 * 7 ? `${Math.round(diff / 86400)} dni`
    : createdAt.toLocaleDateString("pl-PL");
  return <Chip hue={hue} size="sm">{label}</Chip>;
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
