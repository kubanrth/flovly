"use client";

// Nawigacja panelu admina — jedna lista pozycji, dwa wcielenia: stały pasek
// 240px na desktopie i dolny sheet na wąskim ekranie.

import { useState, type ComponentType, type SVGProps } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Chip } from "@/components/ui/chip";
import {
  IconBoards,
  IconChevronLeft,
  IconDoc,
  IconDownload,
  IconGrid,
  IconMenu,
  IconShield,
  IconSliders,
  IconUsers,
} from "@/components/ui/icons";

type IconType = ComponentType<SVGProps<SVGSVGElement>>;

export const ADMIN_NAV: { href: string; label: string; icon: IconType; exact?: boolean }[] = [
  { href: "/admin", label: "Przegląd", icon: IconGrid, exact: true },
  { href: "/admin/users", label: "Użytkownicy", icon: IconUsers },
  { href: "/admin/workspaces", label: "Przestrzenie", icon: IconBoards },
  { href: "/admin/audit", label: "Audyt przestrzeni", icon: IconDoc },
  { href: "/admin/actions", label: "Akcje admina", icon: IconShield },
  { href: "/admin/backups", label: "Backupy", icon: IconDownload },
  { href: "/admin/flags", label: "Flagi systemowe", icon: IconSliders },
];

function isActive(pathname: string, href: string, exact?: boolean): boolean {
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminDesktopSidebar() {
  const pathname = usePathname();
  return (
    <div className="flex h-full flex-col gap-1.5">
      <nav className="flex flex-col gap-0.5">
        {ADMIN_NAV.map((n) => {
          const active = isActive(pathname, n.href, n.exact);
          const Icon = n.icon;
          return (
            <Link
              key={n.href}
              href={n.href}
              data-active={active || undefined}
              className="group flex h-8 shrink-0 items-center gap-2 rounded-md px-2 text-sm text-n-700 outline-none hover:bg-n-100 hover:text-foreground active:bg-n-200 data-active:bg-selected data-active:font-medium data-active:text-foreground data-active:shadow-[inset_2px_0_0_var(--orange-500)]"
            >
              <Icon width={16} height={16} className="shrink-0 text-n-500 group-data-active:text-orange-700" />
              <span className="truncate">{n.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-border pt-1.5">
        <Link
          href="/workspaces"
          className="flex h-8 items-center gap-2 rounded-md px-2 text-sm text-muted-foreground outline-none hover:bg-n-100 hover:text-foreground active:bg-n-200"
        >
          <IconChevronLeft width={16} height={16} /> Wróć do aplikacji
        </Link>
      </div>
    </div>
  );
}

export function AdminMobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const active = ADMIN_NAV.find((n) => isActive(pathname, n.href, n.exact));

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <button
            type="button"
            aria-label="Otwórz nawigację panelu admina"
            className="inline-flex h-11 min-w-11 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-medium outline-none hover:bg-n-100 active:bg-n-200"
          />
        }
      >
        <IconMenu width={16} height={16} className="shrink-0" />
        <span className="truncate">{active?.label ?? "Panel admina"}</span>
      </SheetTrigger>
      <SheetContent side="bottom" showCloseButton={false} className="px-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <span className="sheet-drag-handle" aria-hidden />
        <SheetTitle className="sr-only">Panel admina · nawigacja</SheetTitle>

        <div className="px-1 pt-3 pb-2">
          <Chip hue="orange" size="sm">Super admin</Chip>
        </div>

        <nav className="flex flex-col gap-0.5">
          {ADMIN_NAV.map((n) => {
            const on = isActive(pathname, n.href, n.exact);
            const Icon = n.icon;
            return (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
                data-active={on || undefined}
                className="flex min-h-11 items-center gap-3 rounded-md px-3 text-sm outline-none hover:bg-n-100 active:bg-n-200 data-active:bg-selected data-active:font-medium"
              >
                <Icon width={16} height={16} className="shrink-0 text-n-500" />
                <span className="truncate">{n.label}</span>
              </Link>
            );
          })}
        </nav>

        <Link
          href="/workspaces"
          onClick={() => setOpen(false)}
          className="mt-2 flex min-h-11 items-center gap-2 rounded-md border border-border px-3 text-sm text-muted-foreground outline-none hover:bg-n-100 hover:text-foreground active:bg-n-200"
        >
          <IconChevronLeft width={16} height={16} /> Wróć do aplikacji
        </Link>
      </SheetContent>
    </Sheet>
  );
}
