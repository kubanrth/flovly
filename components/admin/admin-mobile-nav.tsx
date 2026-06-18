"use client";

// Mobile-only bottom sheet replacing the horizontal-scroll sidebar on
// admin pages. Per Mobile v4 spec (B7 — Admin nav · bottom sheet):
// hamburger trigger top-right, sheet rises with rounded-t-24 glass surface,
// each row 44px+ tap target, Super Admin badge above the list.
//
// Desktop sidebar (md:flex) stays untouched — we render this only inside
// the existing aside on `md:hidden`, preserving sticky desktop layout.

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  Database,
  Gavel,
  Layers,
  Menu,
  ScrollText,
  ShieldCheck,
  Users,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

interface AdminNavItemDef {
  href: string;
  label: string;
  icon: typeof ShieldCheck;
  exact?: boolean;
}

const NAV_ITEMS: AdminNavItemDef[] = [
  { href: "/admin", label: "Przegląd", icon: ShieldCheck, exact: true },
  { href: "/admin/users", label: "Użytkownicy", icon: Users },
  { href: "/admin/workspaces", label: "Przestrzenie", icon: Layers },
  { href: "/admin/audit", label: "Audyt workspace", icon: ScrollText },
  { href: "/admin/actions", label: "Akcje admina", icon: Gavel },
  { href: "/admin/backups", label: "Backupy", icon: Database },
];

export function AdminMobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const active = NAV_ITEMS.find((n) =>
    n.exact ? pathname === n.href : pathname === n.href || pathname.startsWith(`${n.href}/`),
  );

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <button
            type="button"
            aria-label="Otwórz panel admina"
            className="inline-flex h-11 min-w-11 items-center gap-2 rounded-lg border border-sidebar-border bg-sidebar-accent/40 px-3 text-[0.84rem] font-medium text-foreground transition-colors hover:bg-sidebar-accent"
          />
        }
      >
        <Menu size={16} className="shrink-0" />
        <span className="truncate">{active?.label ?? "Panel admina"}</span>
      </SheetTrigger>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="rounded-t-2xl border-t border-white/10 bg-popover/95 px-4 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[0_-12px_40px_-12px_rgba(10,10,40,0.5)] backdrop-blur-xl"
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-foreground/20" aria-hidden />
        <SheetTitle className="sr-only">Panel admina · nawigacja</SheetTitle>

        <div className="mb-3 flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-destructive/15 px-2 py-1 font-mono text-[0.6rem] font-bold uppercase tracking-[0.14em] text-destructive">
            <ShieldCheck size={11} /> Super Admin
          </span>
        </div>

        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map((n) => {
            const isActive = n.exact
              ? pathname === n.href
              : pathname === n.href || pathname.startsWith(`${n.href}/`);
            const Icon = n.icon;
            return (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
                data-active={isActive ? "true" : "false"}
                className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-[0.95rem] text-foreground/85 transition-colors hover:bg-accent data-[active=true]:bg-accent data-[active=true]:text-foreground data-[active=true]:font-semibold"
              >
                <Icon size={16} className="shrink-0 text-muted-foreground" />
                <span className="truncate">{n.label}</span>
              </Link>
            );
          })}
        </nav>

        <Link
          href="/workspaces"
          onClick={() => setOpen(false)}
          className="mt-3 flex min-h-12 items-center gap-2 rounded-xl border border-border px-3 text-[0.88rem] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <ArrowLeft size={14} /> Wróć do aplikacji
        </Link>
      </SheetContent>
    </Sheet>
  );
}
