import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/admin-guard";

// Query params: ?action=task.created&actor=admin@…&days=7
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
      ...(sinceMs
        ? { createdAt: { gte: new Date(Date.now() - sinceMs) } }
        : {}),
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
    <main className="flex-1 px-4 py-6 md:px-14 md:py-14">
      <div className="mx-auto flex max-w-6xl flex-col gap-5 md:gap-6">
        <div className="flex flex-col gap-2">
          <span className="eyebrow">Audyt</span>
          <h1 className="font-display text-[1.5rem] font-bold leading-[1.1] tracking-[-0.03em] md:text-[2rem]">
            Globalna historia aktywności
          </h1>
          <p className="text-[0.84rem] text-muted-foreground md:text-[0.88rem]">
            Ostatnie 200 wpisów ze wszystkich przestrzeni. Filtry działają po literale „zawiera”.
          </p>
        </div>

        <form
          action="/admin/audit"
          className="grid grid-cols-1 items-end gap-3 rounded-lg border border-border bg-card p-3 sm:grid-cols-2 md:flex md:flex-wrap"
        >
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground">
              Akcja
            </span>
            <input
              name="action"
              defaultValue={params.action ?? ""}
              placeholder="np. task.updated"
              // Mobile v4: 48px tap target + 16px text to suppress iOS auto-zoom on focus.
              className="h-12 w-full rounded-md border border-border bg-background px-3 text-[16px] outline-none focus:border-primary md:h-9 md:text-[0.86rem] md:w-[220px]"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground">
              Użytkownik
            </span>
            <input
              name="actor"
              defaultValue={params.actor ?? ""}
              placeholder="email / imię"
              className="h-12 w-full rounded-md border border-border bg-background px-3 text-[16px] outline-none focus:border-primary md:h-9 md:text-[0.86rem] md:w-[220px]"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground">
              Okres
            </span>
            <select
              name="days"
              defaultValue={params.days ?? ""}
              className="h-12 rounded-md border border-border bg-background px-3 font-mono text-[16px] uppercase tracking-[0.12em] outline-none focus:border-primary md:h-9 md:text-[0.78rem]"
            >
              <option value="">wszystko</option>
              <option value="1">24 h</option>
              <option value="7">7 dni</option>
              <option value="30">30 dni</option>
              <option value="90">90 dni</option>
            </select>
          </label>
          <button
            type="submit"
            className="inline-flex h-12 items-center justify-center rounded-md border border-border bg-background px-4 font-mono text-[0.74rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground md:h-9 md:text-[0.7rem]"
          >
            Zastosuj
          </button>
        </form>

        {/* Desktop: table view. Mobile (max-md): stacked cards per spec — actor at top
            with avatar initial, action badge, target mono, timestamp right. */}
        <div className="hidden overflow-hidden rounded-xl border border-border bg-card md:block">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left">
            <thead className="border-b border-border bg-muted/50">
              <tr className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground">
                <th className="px-4 py-2">Czas</th>
                <th className="px-4 py-2">Akcja</th>
                <th className="px-4 py-2">Obiekt</th>
                <th className="px-4 py-2">Użytkownik</th>
                <th className="px-4 py-2">Przestrzeń</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <AuditRowView key={e.id} entry={e} />
              ))}
            </tbody>
          </table>
          </div>
          {entries.length === 0 && (
            <p className="px-4 py-8 text-center text-[0.88rem] text-muted-foreground">
              Brak wpisów.
            </p>
          )}
        </div>

        {/* Mobile-only stacked cards. Hidden on md+. */}
        <ul className="flex flex-col gap-2 md:hidden">
          {entries.length === 0 && (
            <li className="rounded-xl border border-border bg-card px-4 py-6 text-center text-[0.88rem] text-muted-foreground">
              Brak wpisów.
            </li>
          )}
          {entries.map((e) => (
            <AuditCardMobile key={e.id} entry={e} />
          ))}
        </ul>
      </div>
    </main>
  );
}

// Mobile v4 (B7 — Audit logs full-screen): each entry becomes a stacked card.
// Actor + avatar initial top, action badge with target mono code under, timestamp right.
function AuditCardMobile({ entry }: { entry: AuditRow }) {
  const actorLabel = entry.actor?.name ?? entry.actor?.email ?? "—";
  const initials = (entry.actor?.name ?? entry.actor?.email ?? "?")
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <li className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center gap-2.5">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-brand-gradient font-mono text-[0.62rem] font-bold text-white">
          {initials || "?"}
        </span>
        <span className="min-w-0 flex-1 truncate text-[0.86rem] font-semibold text-foreground">
          {actorLabel}
        </span>
        <span className="shrink-0 font-mono text-[0.68rem] uppercase tracking-[0.12em] text-muted-foreground">
          {new Date(entry.createdAt).toLocaleString("pl-PL", {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
      <div className="mt-2.5 flex items-center gap-2">
        <code className="inline-flex h-6 items-center rounded-md bg-primary/12 px-2 font-mono text-[0.7rem] font-semibold text-primary">
          {entry.action}
        </code>
        <span className="truncate font-mono text-[0.72rem] text-muted-foreground">
          {entry.objectType}·{entry.objectId.slice(-6)}
        </span>
      </div>
      {entry.workspace && (
        <div className="mt-1.5 font-mono text-[0.66rem] uppercase tracking-[0.12em] text-muted-foreground/80">
          /{entry.workspace.slug}
        </div>
      )}
    </li>
  );
}

function AuditRowView({ entry }: { entry: AuditRow }) {
  return (
    <tr className="border-b border-border last:border-b-0">
      <td className="px-4 py-2 font-mono text-[0.72rem] uppercase tracking-[0.12em] text-muted-foreground">
        {new Date(entry.createdAt).toLocaleString("pl-PL", {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </td>
      <td className="px-4 py-2">
        <code className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[0.72rem]">
          {entry.action}
        </code>
      </td>
      <td className="px-4 py-2 font-mono text-[0.74rem] text-muted-foreground">
        {entry.objectType}·{entry.objectId.slice(-6)}
      </td>
      <td className="px-4 py-2 text-[0.82rem]">
        {entry.actor?.name ?? entry.actor?.email ?? "—"}
      </td>
      <td className="px-4 py-2">
        {entry.workspace ? (
          <span className="font-mono text-[0.68rem] uppercase tracking-[0.12em] text-muted-foreground">
            /{entry.workspace.slug}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
    </tr>
  );
}
