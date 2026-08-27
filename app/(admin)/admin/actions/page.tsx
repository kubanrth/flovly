import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/admin-guard";
import { AuditFilters } from "@/components/admin/audit-filters";
import { Chip, type ChipHue } from "@/components/ui/chip";
import { DataFooter, DataTable, DataTd, DataTh, DataThead, DataTr } from "@/components/ui/data-table";
import { plPlural } from "@/lib/pluralize";

async function loadEntries(params: { action?: string; actor?: string; days?: string }) {
  const days = Number.parseInt(params.days ?? "", 10);
  const sinceMs = Number.isFinite(days) && days > 0 ? days * 24 * 60 * 60 * 1000 : null;
  const since = sinceMs ? new Date(Date.now() - sinceMs) : null;

  return db.adminAuditLog.findMany({
    where: {
      ...(params.action ? { action: { contains: params.action, mode: "insensitive" } } : {}),
      ...(params.actor ? { actorEmail: { contains: params.actor, mode: "insensitive" } } : {}),
      ...(since ? { createdAt: { gte: since } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

type EntryRow = Awaited<ReturnType<typeof loadEntries>>[number];

export default async function AdminActionsPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; actor?: string; days?: string }>;
}) {
  await requireSuperAdmin();
  const params = await searchParams;
  const entries = await loadEntries(params);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2.5">
        <h1 className="text-xl font-semibold tracking-[-0.3px]">Akcje admina</h1>
        <span className="text-xs text-muted-foreground">
          kto kogo zablokował i którą przestrzeń skasował — log ponad przestrzeniami
        </span>
      </div>

      <AuditFilters
        action="/admin/actions"
        actorLabel="Admin"
        actorPlaceholder="e-mail admina"
        actionPlaceholder="np. user.banned"
        defaults={params}
      />

      <DataTable
        className="[--row-h:44px]"
        footer={
          <DataFooter>
            {entries.length} {plPlural(entries.length, "wpis", "wpisy", "wpisów")}
          </DataFooter>
        }
      >
        <DataThead>
          <tr>
            <DataTh width={140}>Czas</DataTh>
            <DataTh width={220}>Akcja</DataTh>
            <DataTh>Cel</DataTh>
            <DataTh width={220}>Admin</DataTh>
          </tr>
        </DataThead>
        <tbody>
          {entries.map((e) => (
            <Row key={e.id} entry={e} />
          ))}
          {entries.length === 0 && (
            <tr>
              <td colSpan={4} className="px-2.5 py-10 text-center text-sm text-muted-foreground">
                Brak wpisów.
              </td>
            </tr>
          )}
        </tbody>
      </DataTable>
    </div>
  );
}

const ACTION_HUE: Record<string, ChipHue> = {
  "user.banned": "red",
  "user.unbanned": "green",
  "user.deleted": "red",
  "workspace.forceDeleted": "red",
  "workspace.restored": "green",
};

function Row({ entry }: { entry: EntryRow }) {
  return (
    <DataTr>
      <DataTd className="font-mono text-2xs text-muted-foreground">
        {new Date(entry.createdAt).toLocaleString("pl-PL", {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </DataTd>
      <DataTd>
        <Chip hue={ACTION_HUE[entry.action] ?? "gray"} size="sm" className="font-mono">
          {entry.action}
        </Chip>
      </DataTd>
      <DataTd>
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="truncate text-xs">{entry.targetLabel ?? entry.targetId}</span>
          <span className="truncate font-mono text-2xs text-fg-3">
            {entry.targetType} · {entry.targetId.slice(-6)}
          </span>
        </span>
      </DataTd>
      <DataTd className="truncate text-xs">{entry.actorEmail}</DataTd>
    </DataTr>
  );
}
