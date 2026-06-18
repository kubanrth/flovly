"use client";

// Persistent desktop sidebar for /admin routes — replaces the inline nav that
// used to live in layout.tsx. Mobile (max-md) still uses AdminMobileNav (bottom
// sheet); this component renders only on md+ via parent `hidden md:flex`.
//
// Spec ref: `Flovly Admin Sub-views & Extras.dc.html` (240px aside, Super Admin
// pill at top, nav rows w/ active state bg-sidebar-accent).

import Link from "next/link";
import {
  ArrowLeft,
  Database,
  Flag,
  Gavel,
  Layers,
  ScrollText,
  ShieldCheck,
  Users,
} from "lucide-react";
import { AdminNavItem } from "@/components/admin/admin-nav-item";

export function AdminDesktopSidebar() {
  return (
    <div className="flex h-full flex-col gap-3">
      {/* Super Admin pill — Mobile v4 spec mirrors this; keep both in sync. */}
      <div className="px-2 pt-1">
        <span className="inline-flex items-center gap-1.5 rounded-md bg-destructive/15 px-2 py-1 font-mono text-[0.58rem] font-bold uppercase tracking-[0.14em] text-destructive">
          <ShieldCheck size={11} /> Super Admin
        </span>
      </div>

      <nav className="flex flex-col gap-0.5">
        <AdminNavItem href="/admin" exact label="Przegląd" icon={<ShieldCheck size={14} />} />
        <AdminNavItem href="/admin/users" label="Użytkownicy" icon={<Users size={14} />} />
        <AdminNavItem href="/admin/workspaces" label="Przestrzenie" icon={<Layers size={14} />} />
        <AdminNavItem href="/admin/audit" label="Audyt workspace" icon={<ScrollText size={14} />} />
        <AdminNavItem href="/admin/actions" label="Akcje admina" icon={<Gavel size={14} />} />
        <AdminNavItem href="/admin/backups" label="Backupy" icon={<Database size={14} />} />
        <AdminNavItem href="/admin/flags" label="Flagi systemowe" icon={<Flag size={14} />} />
      </nav>

      <div className="mt-auto border-t border-sidebar-border pt-3">
        <Link
          href="/workspaces"
          className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-[0.84rem] text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
        >
          <ArrowLeft size={14} /> Wróć do aplikacji
        </Link>
      </div>
    </div>
  );
}
