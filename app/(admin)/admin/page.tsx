import Link from "next/link";
import { db } from "@/lib/db";
import { Users, Layers, FileText, Activity } from "lucide-react";

export default async function AdminDashboard() {
  // Server components run fresh per request; `Date.now()` here is a
  // fixed-point snapshot for this render, not a React render-time impurity.
  // eslint-disable-next-line react-hooks/purity
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [userCount, bannedCount, workspaceCount, deletedWorkspaces, taskCount, commentCount, lastDayAudits] =
    await Promise.all([
      db.user.count({ where: { deletedAt: null } }),
      db.user.count({ where: { isBanned: true, deletedAt: null } }),
      db.workspace.count({ where: { deletedAt: null } }),
      db.workspace.count({ where: { deletedAt: { not: null } } }),
      db.task.count({ where: { deletedAt: null } }),
      db.comment.count({ where: { deletedAt: null } }),
      db.auditLog.count({ where: { createdAt: { gte: since24h } } }),
    ]);

  return (
    <main className="flex-1 px-4 py-6 md:px-14 md:py-14">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 md:gap-8">
        <div className="flex flex-col gap-2">
          <span className="eyebrow">Panel admina</span>
          <h1 className="font-display text-[1.6rem] font-bold leading-[1.1] tracking-[-0.03em] md:text-[2.2rem]">
            Przegląd systemu.
          </h1>
          <p className="max-w-[60ch] text-[0.88rem] leading-[1.5] text-muted-foreground md:text-[0.95rem] md:leading-[1.55]">
            Zarządzanie użytkownikami, przestrzeniami i globalny audyt — wszystko bez kontaktu
            z developerem.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={<Users size={16} />}
            label="Użytkownicy"
            value={userCount}
            note={bannedCount > 0 ? `${bannedCount} zbanowanych` : undefined}
            href="/admin/users"
          />
          <StatCard
            icon={<Layers size={16} />}
            label="Przestrzenie"
            value={workspaceCount}
            note={deletedWorkspaces > 0 ? `${deletedWorkspaces} usuniętych` : undefined}
            href="/admin/workspaces"
          />
          <StatCard
            icon={<FileText size={16} />}
            label="Zadania"
            value={taskCount}
            note={`${commentCount} komentarzy`}
          />
          <StatCard
            icon={<Activity size={16} />}
            label="Akcje (24h)"
            value={lastDayAudits}
            href="/admin/audit"
          />
        </div>
      </div>
    </main>
  );
}

function StatCard({
  icon,
  label,
  value,
  note,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  note?: string;
  href?: string;
}) {
  const body = (
    // F12-K100 fix: equal-height tiles — note slot ZAWSZE renderowany z
    // &nbsp; placeholder gdy brak, żeby wszystkie 4 cards miały taką samą
    // wysokość (wcześniej Użytkownicy + Akcje 24h były krótsze bo brak note).
    <div className="flex h-full flex-col gap-1 rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/60">
      <span className="flex items-center gap-1.5 font-mono text-[0.66rem] uppercase tracking-[0.14em] text-muted-foreground">
        <span className="text-primary">{icon}</span>
        {label}
      </span>
      <span className="font-display text-[1.5rem] font-bold tracking-[-0.02em] md:text-[1.8rem]">
        {value.toLocaleString("pl-PL")}
      </span>
      <span className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-muted-foreground">
        {note ?? " "}
      </span>
    </div>
  );
  if (href) return <Link href={href}>{body}</Link>;
  return body;
}
