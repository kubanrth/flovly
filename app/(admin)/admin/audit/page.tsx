import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/admin-guard";
import { AuditExpandRow } from "@/components/admin/audit-expand-row";
import { AuditFilters } from "@/components/admin/audit-filters";
import { Avatar } from "@/components/ui/avatar";
import { Chip, type ChipHue } from "@/components/ui/chip";
import { DataFooter, DataTable, DataTd, DataTh, DataThead, DataTr } from "@/components/ui/data-table";
import { plPlural } from "@/lib/pluralize";

// Parametry: ?action=task.created&actor=admin@…&days=7
async function loadAudit(params: { action?: string; actor?: string; days?: string }) {
  const days = Number.parseInt(params.days ?? "", 10);
  const sinceMs = Number.isFinite(days) && days > 0 ? days * 24 * 60 * 60 * 1000 : null;

  return db.auditLog.findMany({
    where: {
      ...(params.action ? { action: { contains: params.action, mode: "insensitive" } } : {}),
      ...(params.actor
        ? {
            actor: {
              OR: [
                { email: { contains: params.actor, mode: "insensitive" } },
                { name: { contains: params.actor, mode: "insensitive" } },
              ],
            },
          }
        : {}),
      ...(sinceMs ? { createdAt: { gte: new Date(Date.now() - sinceMs) } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      actor: { select: { id: true, name: true, email: true } },
      workspace: { select: { id: true, name: true, slug: true } },
    },
  });
}

type AuditRow = Awaited<ReturnType<typeof loadAudit>>[number];

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; actor?: string; days?: string }>;
}) {
  await requireSuperAdmin();
  const params = await searchParams;
  const entries = await loadAudit(params);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2.5">
        <h1 className="text-xl font-semibold tracking-[-0.3px]">Audyt przestrzeni</h1>
        <span className="text-xs text-muted-foreground">
          ostatnie 200 wpisów ze wszystkich przestrzeni; filtry działają po fragmencie tekstu
        </span>
      </div>

      <AuditFilters
        action="/admin/audit"
        actorLabel="Użytkownik"
        actorPlaceholder="e-mail lub imię"
        actionPlaceholder="np. task.updated"
        defaults={params}
      />

      {/* Desktop: tabela. Wąski ekran: karty — tabela z 6 kolumn nie mieści się. */}
      <div className="hidden md:block">
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
              <DataTh width={180}>Obiekt</DataTh>
              <DataTh>Użytkownik</DataTh>
              <DataTh width={150}>Przestrzeń</DataTh>
              <DataTh width={44} aria-label="Szczegóły" />
            </tr>
          </DataThead>
          <tbody>
            {entries.map((e) => (
              <AuditTableRow key={e.id} entry={e} />
            ))}
            {entries.length === 0 && (
              <tr>
                <td colSpan={6} className="px-2.5 py-10 text-center text-sm text-muted-foreground">
                  Brak wpisów.
                </td>
              </tr>
            )}
          </tbody>
        </DataTable>
      </div>

      <ul className="flex flex-col gap-2 md:hidden">
        {entries.length === 0 && (
          <li className="rounded-lg border border-border bg-card px-3 py-6 text-center text-sm text-muted-foreground">
            Brak wpisów.
          </li>
        )}
        {entries.map((e) => (
          <AuditCardMobile key={e.id} entry={e} />
        ))}
      </ul>
    </div>
  );
}

function AuditCardMobile({ entry }: { entry: AuditRow }) {
  const actorLabel = entry.actor?.name ?? entry.actor?.email ?? "—";
  return (
    <li className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center gap-2.5">
        <Avatar name={actorLabel} size={24} />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{actorLabel}</span>
        <span className="shrink-0 font-mono text-2xs text-fg-3">{formatStamp(entry.createdAt)}</span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <ActionChip action={entry.action} />
        <span className="truncate font-mono text-2xs text-muted-foreground">
          {entry.objectType}·{entry.objectId.slice(-6)}
        </span>
      </div>
      {entry.workspace && (
        <p className="mt-1 font-mono text-2xs text-fg-3">/{entry.workspace.slug}</p>
      )}
    </li>
  );
}

function AuditTableRow({ entry }: { entry: AuditRow }) {
  const actorLabel = entry.actor?.name ?? entry.actor?.email ?? "—";
  const diffShape = normaliseDiff(entry.diff);
  const hasDiff = !!(diffShape.old || diffShape.new || diffShape.flat);

  return (
    <DataTr>
      <DataTd className="font-mono text-2xs text-muted-foreground">{formatStamp(entry.createdAt)}</DataTd>
      <DataTd><ActionChip action={entry.action} /></DataTd>
      <DataTd className="font-mono text-2xs text-muted-foreground">
        {entry.objectType}·{entry.objectId.slice(-6)}
      </DataTd>
      <DataTd>
        <span className="flex items-center gap-2">
          <Avatar name={actorLabel} size={22} />
          <span className="truncate text-xs">{actorLabel}</span>
        </span>
      </DataTd>
      <DataTd className="font-mono text-2xs text-muted-foreground">
        {entry.workspace ? `/${entry.workspace.slug}` : "—"}
      </DataTd>
      <DataTd align="right" className="relative">
        <AuditExpandRow hasDiff={hasDiff} diff={diffShape} colSpan={6} />
      </DataTd>
    </DataTr>
  );
}

// ── Pomocnicze ────────────────────────────────────────────────────

function formatStamp(date: Date): string {
  return new Date(date).toLocaleString("pl-PL", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Czasownik po ostatniej kropce (`task.updated`) decyduje o odcieniu chipa. */
function actionHue(action: string): ChipHue {
  const verb = action.split(".").pop()?.toLowerCase() ?? "";
  if (verb.startsWith("create")) return "green";
  if (verb.startsWith("delete") || verb.startsWith("remove") || verb.startsWith("ban") || verb === "kicked") {
    return "red";
  }
  if (
    verb.startsWith("update") || verb.startsWith("change") || verb.startsWith("rename") ||
    verb.startsWith("move") || verb.startsWith("assign") || verb.startsWith("set")
  ) {
    return "yellow";
  }
  return "gray";
}

function ActionChip({ action }: { action: string }) {
  return (
    <Chip hue={actionHue(action)} size="sm" className="font-mono">
      {action}
    </Chip>
  );
}

// `diff` nie jest znormalizowany historycznie — {from,to} / {old,new} / płaski
// obiekt. Sprowadzamy do jednego kształtu dla wiersza szczegółów.
function normaliseDiff(raw: unknown): {
  old: Record<string, unknown> | null;
  new: Record<string, unknown> | null;
  flat: Record<string, unknown> | null;
} {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { old: null, new: null, flat: null };
  const obj = raw as Record<string, unknown>;
  if ("old" in obj || "new" in obj) {
    return {
      old: (obj.old as Record<string, unknown>) ?? null,
      new: (obj.new as Record<string, unknown>) ?? null,
      flat: null,
    };
  }
  if ("from" in obj || "to" in obj) {
    return { old: { value: obj.from ?? null }, new: { value: obj.to ?? null }, flat: null };
  }
  return { old: null, new: null, flat: obj };
}
