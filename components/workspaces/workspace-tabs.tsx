"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Settings, Users } from "lucide-react";

export interface WorkspaceTabsProps {
  workspaceId: string;
  canEditSettings: boolean;
  roleLabel: string;
}

// Tabs nawigacyjne workspace'u (Przegląd / Członkowie / Ustawienia).
// Klient: "zlewa się — Przegląd, Członkowie, Ustawienia trzeba poprawić UX".
// Dotąd były to gołe eyebrow-styled Linki w nav'ie — nieczytelne jako tab'y,
// brak active state'a. Teraz prawdziwe button-style pille z ikonkami, kolorowym
// underline pod aktywnym + tinted bg, większy hit-area dla mobile.
export function WorkspaceTabs({
  workspaceId,
  canEditSettings,
  roleLabel,
}: WorkspaceTabsProps) {
  const pathname = usePathname();
  const baseHref = `/w/${workspaceId}`;
  // /w/[id] = overview, /w/[id]/members, /w/[id]/settings
  // Ścisłe matching żeby /w/[id]/b/[bid]/... NIE robił "Przegląd" aktywnym.
  const isOverview = pathname === baseHref;
  const isMembers = pathname === `${baseHref}/members`;
  const isSettings = pathname === `${baseHref}/settings`;

  return (
    <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:gap-2 md:overflow-visible md:px-0">
      <TabLink
        href={baseHref}
        label="Przegląd"
        icon={<LayoutGrid size={13} />}
        active={isOverview}
      />
      <TabLink
        href={`${baseHref}/members`}
        label="Członkowie"
        icon={<Users size={13} />}
        active={isMembers}
      />
      {canEditSettings && (
        <TabLink
          href={`${baseHref}/settings`}
          label="Ustawienia"
          icon={<Settings size={13} />}
          active={isSettings}
        />
      )}
      <span className="hidden shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 font-mono text-[0.6rem] uppercase tracking-[0.12em] text-muted-foreground md:inline-flex">
        Rola
        <span className="text-foreground">{roleLabel}</span>
      </span>
    </div>
  );
}

function TabLink({
  href,
  label,
  icon,
  active,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  active: boolean;
}) {
  return (
    // Emil's "should this animate at all?" — tabs są klikane stale, więc
    // tylko transition-colors (border + bg + text), bez transformy/spring.
    // active:scale-[0.98] = 1 frame visual press feedback, motion-reduce
    // wyłącza. Routing nav daje ostry switch routera, scale daje user'owi
    // "kliknięte" cue zanim Next.js wystartuje navigation.
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 font-sans text-[0.82rem] font-medium transition-colors active:scale-[0.98] motion-reduce:active:scale-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
        active
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:bg-accent hover:text-foreground"
      }`}
    >
      <span className={active ? "text-primary" : "text-muted-foreground"}>
        {icon}
      </span>
      {label}
    </Link>
  );
}
