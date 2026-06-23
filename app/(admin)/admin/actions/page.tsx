import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/admin-guard";
import {
  Ban,
  Check,
  RotateCcw,
  ShieldCheck,
  Trash2,
  type LucideIcon,
} from "lucide-react";

async function loadEntries(params: { action?: string; actor?: string; days?: string }) {
  const days = Number.parseInt(params.days ?? "", 10);
  const sinceMs = Number.isFinite(days) && days > 0 ? days * 24 * 60 * 60 * 1000 : null;
  const since = sinceMs ? new Date(Date.now() - sinceMs) : null;

  return db.adminAuditLog.findMany({
    where: {
      ...(params.action ? { action: { contains: params.action, mode: "insensitive" } } : {}),
      ...(params.actor
        ? { actorEmail: { contains: params.actor, mode: "insensitive" } }
        : {}),
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
    <main className="flex-1 px-4 py-6 md:px-14 md:py-14">
      <div className="mx-auto flex max-w-6xl flex-col gap-5 md:gap-6">
        <div className="flex flex-col gap-2">
          <span className="eyebrow">Akcje administracyjne</span>
          <h1 className="font-display text-[1.5rem] font-bold leading-[1.1] tracking-[-0.03em] md:text-[2rem]">
            Historia decyzji
          </h1>
          <p className="text-[0.84rem] text-muted-foreground md:text-[0.88rem]">
            Kto zablokował kogo, skasował którą przestrzeń. Osobny log od audytu
            workspace’owego, bo tu są operacje cross-workspace.
          </p>
        </div>

        <form
          action="/admin/actions"
          className="grid grid-cols-1 items-end gap-3 rounded-lg border border-border bg-card p-3 sm:grid-cols-2 md:flex md:flex-wrap"
        >
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground">
              Akcja
            </span>
            <input
              name="action"
              defaultValue={params.action ?? ""}
              placeholder="np. user.banned"
              className="h-9 w-full rounded-md border border-border bg-background px-3 text-[0.86rem] outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40 md:w-[220px]"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground">
              Admin
            </span>
            <input
              name="actor"
              defaultValue={params.actor ?? ""}
              placeholder="email admina"
              className="h-9 w-full rounded-md border border-border bg-background px-3 text-[0.86rem] outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40 md:w-[220px]"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground">
              Okres
            </span>
            <select
              name="days"
              defaultValue={params.days ?? ""}
              className="h-9 rounded-md border border-border bg-background px-3 font-mono text-[0.78rem] uppercase tracking-[0.12em] outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40"
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
            className="inline-flex h-9 items-center rounded-md border border-border bg-background px-3 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
          >
            Zastosuj
          </button>
        </form>

        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left">
            <thead className="border-b border-border bg-muted/50">
              <tr className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground">
                <th className="px-4 py-2">Czas</th>
                <th className="px-4 py-2">Akcja</th>
                <th className="px-4 py-2">Cel</th>
                <th className="px-4 py-2">Admin</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <Row key={e.id} entry={e} />
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
      </div>
    </main>
  );
}

const ICON: Record<string, { icon: LucideIcon; tone: string }> = {
  "user.banned": {
    icon: Ban,
    tone: "text-destructive bg-destructive/10",
  },
  "user.unbanned": {
    icon: Check,
    tone: "text-primary bg-primary/10",
  },
  "user.deleted": {
    icon: Trash2,
    tone: "text-destructive bg-destructive/10",
  },
  "workspace.forceDeleted": {
    icon: Trash2,
    tone: "text-destructive bg-destructive/10",
  },
  "workspace.restored": {
    icon: RotateCcw,
    tone: "text-primary bg-primary/10",
  },
};

function Row({ entry }: { entry: EntryRow }) {
  const meta = ICON[entry.action] ?? { icon: ShieldCheck, tone: "bg-muted text-muted-foreground" };
  const Icon = meta.icon;
  return (
    <tr className="border-b border-border last:border-b-0">
      <td className="px-4 py-2 font-mono text-[0.7rem] uppercase tracking-[0.12em] text-muted-foreground">
        {new Date(entry.createdAt).toLocaleString("pl-PL", {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </td>
      <td className="px-4 py-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-[0.62rem] uppercase tracking-[0.14em] ${meta.tone}`}
        >
          <Icon size={10} />
          {entry.action}
        </span>
      </td>
      <td className="px-4 py-2 text-[0.82rem]">
        <div className="flex flex-col">
          <span className="truncate">{entry.targetLabel ?? entry.targetId}</span>
          <span className="font-mono text-[0.6rem] uppercase tracking-[0.12em] text-muted-foreground/80">
            {entry.targetType} · {entry.targetId.slice(-6)}
          </span>
        </div>
      </td>
      <td className="px-4 py-2 text-[0.82rem]">{entry.actorEmail}</td>
    </tr>
  );
}
