"use client";

// Workspace header (C1): 40px letter tile, 24px editable name, meta line,
// avatar stack, page actions, ⋯ menu — then the Tablice/Członkowie/Ustawienia
// tabs. Rendered by the overview page (`bleed`, full-bleed 32px padding) and by
// the members/settings pages (inside their own page padding).

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { EditableWorkspaceName } from "@/components/workspaces/editable-workspace-name";
import { AvatarStack } from "@/components/ui/avatar";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/dropdown-menu";
import { IconCalendar, IconMore, IconSettings, IconUsers } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

export interface WorkspaceHeaderMember {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export function WorkspaceHeader({
  workspace,
  canEditSettings,
  meta,
  members,
  actions,
  bleed = false,
}: {
  workspace: { id: string; name: string; slug: string; description?: string | null };
  canEditSettings: boolean;
  /** „3 tablice · 7 osób · utworzona 12 maja 2026” */
  meta?: string;
  members?: WorkspaceHeaderMember[];
  actions?: ReactNode;
  bleed?: boolean;
}) {
  const pathname = usePathname();
  const base = `/w/${workspace.id}`;
  const pad = bleed ? "px-8 max-md:px-4" : "";
  const tabs = [
    { href: base, label: "Tablice", active: pathname === base },
    { href: `${base}/members`, label: "Członkowie", active: pathname.startsWith(`${base}/members`) },
    ...(canEditSettings
      ? [{ href: `${base}/settings`, label: "Ustawienia", active: pathname.startsWith(`${base}/settings`) }]
      : []),
  ];

  return (
    <header className={cn("flex-none border-b border-border bg-card", bleed && "pt-4")}>
      <div className={cn("flex items-center gap-3 max-md:flex-wrap", pad)}>
        <span
          aria-hidden
          className="grid size-10 shrink-0 place-items-center rounded-lg bg-orange-100 text-md font-bold text-orange-800"
        >
          {workspace.name.trim().charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0">
          {/* [&>button>svg]:opacity-100 — the mockup shows the edit pencil at rest. */}
          <h1 className="-ml-1 min-w-0 text-xl font-semibold tracking-[-0.3px] [&>button]:mx-0 [&>button>svg]:opacity-100">
            <EditableWorkspaceName workspaceId={workspace.id} name={workspace.name} canEdit={canEditSettings} />
          </h1>
          {meta && <p className="text-xs text-muted-foreground">{meta}</p>}
        </div>
        <span className="flex-1 max-md:hidden" />
        {members && members.length > 0 && (
          <AvatarStack people={members.map((m) => ({ name: m.name, src: m.avatarUrl }))} max={3} size={24} className="mr-1" />
        )}
        {actions}
        <Menu>
          <MenuTrigger
            aria-label="Menu przestrzeni"
            className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground outline-none hover:bg-n-100 hover:text-foreground focus-visible:shadow-[var(--focus)] active:bg-n-200"
          >
            <IconMore />
          </MenuTrigger>
          <MenuContent align="end">
            <MenuItem icon={<IconUsers />} render={<Link href={`${base}/members`} />}>
              Członkowie
            </MenuItem>
            <MenuItem icon={<IconCalendar />} render={<Link href={`${base}/calendar`} />}>
              Kalendarz przestrzeni
            </MenuItem>
            {canEditSettings && (
              <MenuItem icon={<IconSettings />} render={<Link href={`${base}/settings`} />}>
                Ustawienia
              </MenuItem>
            )}
          </MenuContent>
        </Menu>
      </div>

      <nav aria-label="Sekcje przestrzeni" className={cn("mt-2.5 flex items-center gap-0.5", pad)}>
        {tabs.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            aria-current={t.active ? "page" : undefined}
            className={cn(
              "inline-flex h-10 items-center rounded-sm px-2.5 text-sm font-medium outline-none focus-visible:shadow-[var(--focus)]",
              t.active
                ? "text-foreground shadow-[inset_0_-2px_0_var(--orange-500)]"
                : "text-muted-foreground hover:text-foreground active:text-foreground",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
