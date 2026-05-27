import Link from "next/link";
import { ShieldCheck, Users, Layers, ScrollText, ArrowLeft, Database, Gavel } from "lucide-react";
import { requireSuperAdmin } from "@/lib/admin-guard";
import { AdminNavItem } from "@/components/admin/admin-nav-item";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireSuperAdmin();

  return (
    <div className="flex min-h-dvh flex-col bg-background md:flex-row">
      {/* Mobile: sidebar collapses to a horizontal-scroll top bar. Desktop: fixed 240px sidebar. */}
      <aside className="flex shrink-0 flex-col gap-2 border-b border-sidebar-border bg-sidebar md:w-[240px] md:border-b-0 md:border-r md:px-3 md:py-4">
        <div className="flex items-center justify-between gap-2 px-3 py-3 md:px-2 md:py-1">
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-primary text-primary-foreground">
              <ShieldCheck size={14} />
            </span>
            <div className="flex flex-col leading-tight">
              <span className="font-display text-[0.92rem] font-semibold tracking-[-0.01em]">
                Panel admina
              </span>
              <span className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-muted-foreground">
                super admin
              </span>
            </div>
          </div>
          <Link
            href="/workspaces"
            className="inline-flex items-center gap-1.5 rounded-sm px-2 py-1 font-mono text-[0.66rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground md:hidden"
          >
            <ArrowLeft size={12} /> wróć
          </Link>
        </div>

        <nav className="-mx-px flex gap-0.5 overflow-x-auto border-t border-sidebar-border px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mt-2 md:flex-col md:overflow-visible md:border-t-0 md:px-0 md:py-0">
          <AdminNavItem href="/admin" exact label="Przegląd" icon={<ShieldCheck size={14} />} />
          <AdminNavItem href="/admin/users" label="Użytkownicy" icon={<Users size={14} />} />
          <AdminNavItem href="/admin/workspaces" label="Przestrzenie" icon={<Layers size={14} />} />
          <AdminNavItem href="/admin/audit" label="Audyt workspace" icon={<ScrollText size={14} />} />
          <AdminNavItem href="/admin/actions" label="Akcje admina" icon={<Gavel size={14} />} />
          <AdminNavItem href="/admin/backups" label="Backupy" icon={<Database size={14} />} />
        </nav>

        <div className="mt-auto hidden border-t border-sidebar-border pt-3 md:block">
          <Link
            href="/workspaces"
            className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-[0.84rem] text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
          >
            <ArrowLeft size={14} /> Wróć do aplikacji
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
