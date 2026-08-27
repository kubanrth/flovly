import Link from "next/link";
import { db } from "@/lib/db";
import { IconBoards, IconDoc, IconTasks, IconUsers } from "@/components/ui/icons";

export default async function AdminDashboard() {
  // Serwerowy render liczy „teraz" raz na żądanie — to migawka, nie nieczystość.
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
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2.5">
        <h1 className="text-xl font-semibold tracking-[-0.3px]">Przegląd systemu</h1>
        <span className="text-xs text-muted-foreground">
          użytkownicy, przestrzenie i audyt bez kontaktu z developerem
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<IconUsers width={14} height={14} />}
          label="Użytkownicy"
          value={userCount}
          note={bannedCount > 0 ? `${bannedCount} zbanowanych` : undefined}
          href="/admin/users"
        />
        <StatCard
          icon={<IconBoards width={14} height={14} />}
          label="Przestrzenie"
          value={workspaceCount}
          note={deletedWorkspaces > 0 ? `${deletedWorkspaces} usuniętych` : undefined}
          href="/admin/workspaces"
        />
        <StatCard
          icon={<IconTasks width={14} height={14} />}
          label="Zadania"
          value={taskCount}
          note={`${commentCount} komentarzy`}
        />
        <StatCard
          icon={<IconDoc width={14} height={14} />}
          label="Akcje (24 h)"
          value={lastDayAudits}
          href="/admin/audit"
        />
      </div>
    </div>
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
  // Slot na dopisek renderowany zawsze (twarda spacja), żeby cztery kafle
  // miały identyczną wysokość — pilnuje tego e2e 11-admin-panel.
  const body = (
    <div
      data-testid="stat-card"
      className="flex h-full flex-col gap-0.5 rounded-lg border border-border bg-canvas px-3.5 py-3"
    >
      <span className="flex items-center gap-1.5 text-2xs text-fg-3">
        <span className="text-n-500">{icon}</span>
        {label}
      </span>
      <span className="font-mono text-lg font-semibold">{value.toLocaleString("pl-PL")}</span>
      <span className="font-mono text-2xs text-fg-3">{note ?? " "}</span>
    </div>
  );
  if (href) {
    return (
      <Link href={href} className="rounded-lg outline-none [&>div]:hover:border-input-border-hover [&>div]:hover:bg-n-100">
        {body}
      </Link>
    );
  }
  return body;
}
