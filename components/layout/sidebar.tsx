"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Bell,
  BookOpen,
  FileText,
  LifeBuoy,
  CalendarDays,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Compass,
  FolderOpen,
  Inbox,
  Layers,
  LogOut,
  Menu,
  Plus,
  Settings,
  ShieldCheck,
  StickyNote,
  X,
} from "lucide-react";
import type { Role } from "@/lib/generated/prisma/enums";
import { signOutAction } from "@/app/(app)/actions";
import { CreateBoardDialog } from "@/components/workspaces/create-board-dialog";
import { DeleteBoardDialog } from "@/components/workspaces/delete-board-dialog";
import { ThemeToggle } from "@/components/layout/theme-toggle";

export interface SidebarUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  isSuperAdmin: boolean;
}

export interface SidebarWorkspace {
  id: string;
  name: string;
  slug: string;
  role: Role;
  boards: { id: string; name: string }[];
  enabledViews: Array<"TABLE" | "KANBAN" | "ROADMAP" | "GANTT" | "WHITEBOARD">;
  // F12-K38: licznik aktywnych zgłoszeń supportu (status=OPEN, IN_PROGRESS;
  // bez RESOLVED/CLOSED). Renderowany jako badge przy linku Support.
  openSupportCount?: number;
}

// F12-K41c: bumped key od ".collapsed" → ".collapsed.v2". Klient miał
// stary collapsed=1 z poprzednich sesji w localStorage; nowy key
// = ignoring tego state'u i startujemy expanded jak default. User
// dalej może zwijać przez chevron — nowe ustawienie persistuje pod v2.
const STORAGE_KEY = "danielos.sidebar.collapsed.v2";

export function Sidebar({
  user,
  workspaces,
  unreadNotificationCount,
}: {
  user: SidebarUser;
  workspaces: SidebarWorkspace[];
  unreadNotificationCount: number;
}) {
  const pathname = usePathname();
  const activeWorkspaceId = pathname.match(/^\/w\/([^/]+)/)?.[1] ?? null;
  const [collapsed, setCollapsed] = useState(false);
  // F12-K41: mobile drawer state. Na desktopie sidebar jest zawsze
  // visible (sticky inline w flex'ie); na mobile (md-) sidebar jest
  // domyślnie schowany (translate-x-[-100%]) i otwierany przyciskiem
  // hamburger w prawym górnym rogu.
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    new Set(activeWorkspaceId ? [activeWorkspaceId] : []),
  );

  // Auto-close drawer przy zmianie route'a — nie chcemy żeby drawer
  // zostawał otwarty po klik'u w link.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Esc zamyka drawer.
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  // Block body scroll gdy mobile drawer otwarty (lepszy UX).
  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  // Expand active workspace when navigating to it.
  useEffect(() => {
    if (activeWorkspaceId) {
      setExpandedIds((prev) => {
        if (prev.has(activeWorkspaceId)) return prev;
        const next = new Set(prev);
        next.add(activeWorkspaceId);
        return next;
      });
    }
  }, [activeWorkspaceId]);

  // Persist collapse state locally.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "1") setCollapsed(true);
    } catch {
      /* noop */
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
    } catch {
      /* noop */
    }
  }, [collapsed]);

  const toggleWorkspace = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const initials = (user.name ?? user.email).slice(0, 2).toUpperCase();

  return (
    <>
      {/* F12-K41: mobile-only hamburger button. Pokazuje się tylko gdy
          sidebar jest schowany (drawer zamknięty). Zawiera Menu icon →
          klik otwiera drawer. Przycisk X w samym drawer (top-right
          obok kolaps button) zamyka. */}
      {!mobileOpen && (
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Otwórz menu"
          // F12-K41: z-[80] — wyżej niż NotificationToaster (z-70) i
          // ReminderPopups (z-60), żeby toast'y nie zasłaniały hamburger'a
          // gdy lecą w prawym górnym rogu.
          // F12-K57: h-11 w-11 = 44px tap target (Apple HIG min).
          className="fixed right-3 top-3 z-[80] grid h-11 w-11 place-items-center rounded-lg border border-border bg-card/95 text-foreground shadow-lg backdrop-blur transition-colors hover:bg-accent md:hidden"
        >
          <Menu size={20} />
        </button>
      )}

      {/* F12-K57: drawer jest fullscreen na mobile, więc backdrop nie
          jest już potrzebny (klient i tak nic za drawer'em nie widzi).
          Zostawiamy strukturę gotową, ale render'ujemy null na max-md. */}

      <aside
      data-collapsed={collapsed ? "true" : "false"}
      data-mobile-open={mobileOpen ? "true" : "false"}
      // F12-K9: sticky top-0 + self-start trzymają sidebar pinned do
      // góry viewportu kiedy długa strona scrolluje. h-dvh sprawia że
      // sidebar zawsze ma dokładnie wysokość viewportu (jego własny
      // overflow-y na .nav scrollu wewnątrz). overflow-hidden zapobiega
      // przeciekaniu zawartości poza widok kiedy collapse anim jest mid.
      //
      // F12-K41 + F12-K41b: dual-mode — mobile drawer (max-md) vs
      // desktop sticky (md+). KRYTYCZNE: wszystkie reguły mobile drawer
      // używają `max-md:` prefix'a, żeby NIE leciały na desktop. Inaczej
      // `data-[mobile-open=false]:-translate-x-full` (specyficzność 0,2,0)
      // bije `md:translate-x-0` (0,1,0) i sidebar zostaje schowany na
      // desktop'ie. `max-md:` generuje regułę tylko w `@media (max-width)`
      // więc na md+ rules po prostu nie istnieją.
      //
      // F12-K57: drawer fullscreen (max-md:inset-0 + max-md:w-full) —
      // klient narzekał że stary 280px-szeroki drawer wyglądał mega
      // wąsko obok blur'owanego tła. Pełny ekran = jasna afordancja
      // "to jest menu, X żeby zamknąć".
      className="group/sidebar flex h-dvh flex-col overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[transform,width] duration-200 max-md:fixed max-md:inset-0 max-md:z-40 max-md:w-full max-md:border-r-0 max-md:data-[mobile-open=false]:-translate-x-full max-md:data-[mobile-open=true]:translate-x-0 md:sticky md:top-0 md:self-start data-[collapsed=true]:md:w-[68px] data-[collapsed=false]:md:w-[248px]"
    >
      {/* Top: profile + collapse toggle */}
      {/* F12-K41d: gdy collapsed, header przełącza się w pion (avatar
          na górze, chevron pod nim). Inaczej w row 68px szerokości
          chevron był 'overflow-clipped' przez parent overflow-hidden i
          klient nie miał jak rozwinąć sidebar'a z powrotem. */}
      <div
        className={`flex gap-2 border-b border-sidebar-border px-3 py-3 ${
          collapsed
            ? "flex-col items-center"
            : "items-center justify-between"
        }`}
      >
        <Link
          href="/profile"
          className="flex min-w-0 items-center gap-2.5 rounded-sm px-1.5 py-1 transition-colors hover:bg-sidebar-accent focus-visible:bg-sidebar-accent focus-visible:outline-none"
        >
          <span className="relative grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-brand-gradient font-display text-[0.72rem] font-bold text-white">
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              initials
            )}
          </span>
          {!collapsed && (
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate font-display text-[0.92rem] font-semibold tracking-[-0.01em]">
                {user.name ?? user.email.split("@")[0]}
              </div>
              <div className="truncate font-mono text-[0.64rem] uppercase tracking-[0.14em] text-muted-foreground">
                {user.isSuperAdmin ? "super admin" : "member"}
              </div>
            </div>
          )}
        </Link>
        <div className="flex shrink-0 items-center gap-1">
          {/* F12-K41: mobile X (zamyka drawer) — schowany na md+.
              F12-K57: bump tap-target z 28px → 44px (Apple HIG / Material min)
              i powiększony chevron icon. Bez backdrop'a X jest jedyną drogą
              zamknięcia drawer'a na mobile (+ Esc), więc musi być żeby trafić. */}
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground md:hidden"
            aria-label="Zamknij menu"
          >
            <X size={20} />
          </button>
          {/* Desktop chevron — collapse/expand sidebar, schowany na mobile. */}
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            className="hidden h-7 w-7 shrink-0 place-items-center rounded-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground md:grid"
            aria-label={collapsed ? "Rozwiń panel" : "Zwiń panel"}
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>
      </div>

      {/* Quick actions */}
      <nav className="flex flex-col gap-0.5 border-b border-sidebar-border px-2 py-2">
        <NavItem
          href="/inbox"
          icon={<Inbox size={15} />}
          label="Powiadomienia"
          pathname={pathname}
          collapsed={collapsed}
          badge={unreadNotificationCount > 0 ? unreadNotificationCount : undefined}
        />
        <NavItem
          href="/my-tasks"
          icon={<Compass size={15} />}
          label="Zadania dla Ciebie"
          pathname={pathname}
          collapsed={collapsed}
        />
        <NavItem
          href="/my/todo"
          icon={<CheckSquare size={15} />}
          label="TO DO"
          pathname={pathname}
          collapsed={collapsed}
        />
        <NavItem
          href="/my/calendar"
          icon={<CalendarDays size={15} />}
          label="Kalendarz"
          pathname={pathname}
          collapsed={collapsed}
        />
        <NavItem
          href="/my/notes"
          icon={<StickyNote size={15} />}
          label="Notatnik"
          pathname={pathname}
          collapsed={collapsed}
        />
        <NavItem
          href="/my/reminders"
          icon={<Bell size={15} />}
          label="Przypomnienia"
          pathname={pathname}
          collapsed={collapsed}
        />
        <NavItem
          href="/workspaces"
          icon={<Layers size={15} />}
          label="Wszystkie przestrzenie"
          pathname={pathname}
          collapsed={collapsed}
          exact
        />
      </nav>

      {/* Workspaces — accordion */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {!collapsed && (
          <div className="mb-2 flex items-center justify-between px-2">
            <span className="eyebrow">Przestrzenie</span>
            <Link
              href="/workspaces"
              aria-label="Nowa przestrzeń"
              className="grid h-5 w-5 place-items-center rounded-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
            >
              <Plus size={13} />
            </Link>
          </div>
        )}
        <div className="flex flex-col gap-0.5">
          {workspaces.map((ws) => {
            const expanded = expandedIds.has(ws.id);
            const isInWorkspace = ws.id === activeWorkspaceId;
            // F12-K19: workspace row highlighted ONLY gdy jesteś na
            // workspace overview / sub-link (Wiki/Support/itd.). Gdy
            // jesteś na konkretnej tablicy → highlight idzie do tej
            // tablicy, workspace traci accent (zostaje rozwinięty).
            const onBoardInWs = pathname.startsWith(`/w/${ws.id}/b/`);
            const isActive = isInWorkspace && !onBoardInWs;
            return (
              <div key={ws.id} className="flex flex-col">
                <div
                  data-active={isActive ? "true" : "false"}
                  className="group relative flex items-center gap-1 rounded-sm data-[active=true]:bg-sidebar-accent"
                >
                  {isActive && (
                    <span
                      aria-hidden
                      className="absolute -left-2 top-1 bottom-1 w-[2px] bg-primary"
                    />
                  )}
                  <Link
                    href={`/w/${ws.id}`}
                    className="flex min-w-0 flex-1 items-center gap-2 rounded-sm px-2 py-1.5 text-[0.88rem] transition-colors hover:bg-sidebar-accent"
                  >
                    <FolderOpen size={15} className="shrink-0 text-muted-foreground" />
                    {!collapsed && (
                      <span className="min-w-0 flex-1 truncate tracking-tight">
                        {ws.name}
                      </span>
                    )}
                  </Link>
                  {!collapsed && canCreateBoard(ws.role) && (
                    <CreateBoardDialog
                      workspaceId={ws.id}
                      workspaceEnabledViews={ws.enabledViews}
                    />
                  )}
                  {!collapsed && (
                    <button
                      type="button"
                      onClick={() => toggleWorkspace(ws.id)}
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
                      aria-label={expanded ? "Zwiń" : "Rozwiń"}
                      aria-expanded={expanded}
                    >
                      <ChevronDown
                        size={13}
                        className={`transition-transform ${expanded ? "rotate-0" : "-rotate-90"}`}
                      />
                    </button>
                  )}
                </div>

                {!collapsed && expanded && (
                  <div className="mt-1 flex flex-col gap-0.5 pl-7">
                    {ws.boards.length === 0 && (
                      <span className="px-2 py-1 font-mono text-[0.66rem] uppercase tracking-[0.14em] text-muted-foreground/70">
                        brak tablic
                      </span>
                    )}
                    {ws.boards.map((b) => {
                      // F12-K19: aktywna tablica = pathname zaczyna się
                      // od /w/<wid>/b/<bid> (czyli table/kanban/roadmap/
                      // gantt/whiteboard/v/* dla tej tablicy).
                      const boardActive = pathname.startsWith(
                        `/w/${ws.id}/b/${b.id}`,
                      );
                      return (
                        <div
                          key={b.id}
                          data-active={boardActive ? "true" : "false"}
                          className="group relative flex items-center gap-1 rounded-sm data-[active=true]:bg-sidebar-accent"
                        >
                          {boardActive && (
                            <span
                              aria-hidden
                              className="absolute -left-[18px] top-1 bottom-1 w-[2px] bg-primary"
                            />
                          )}
                          <Link
                            href={`/w/${ws.id}/b/${b.id}/table`}
                            className={`min-w-0 flex-1 truncate rounded-sm px-2 py-1 text-[0.82rem] transition-colors hover:bg-sidebar-accent hover:text-foreground ${
                              boardActive
                                ? "font-semibold text-foreground"
                                : "text-muted-foreground"
                            }`}
                          >
                            {b.name}
                          </Link>
                          {canManage(ws.role) && (
                            <DeleteBoardDialog
                              workspaceId={ws.id}
                              boardId={b.id}
                              boardName={b.name}
                            />
                          )}
                        </div>
                      );
                    })}
                    <WsSubLink
                      href={`/w/${ws.id}/wiki`}
                      icon={<BookOpen size={11} />}
                      label="Wiki"
                      active={pathname.startsWith(`/w/${ws.id}/wiki`)}
                    />
                    <WsSubLink
                      href={`/w/${ws.id}/support`}
                      icon={<LifeBuoy size={11} />}
                      label="Support"
                      active={pathname.startsWith(`/w/${ws.id}/support`)}
                      badge={ws.openSupportCount}
                    />
                    <WsSubLink
                      href={`/w/${ws.id}/briefs`}
                      icon={<FileText size={11} />}
                      label="Creative Board"
                      active={pathname.startsWith(`/w/${ws.id}/briefs`)}
                    />
                    <WsSubLink
                      href={`/w/${ws.id}/calendar`}
                      icon={<CalendarDays size={11} />}
                      label="Kalendarz"
                      active={pathname.startsWith(`/w/${ws.id}/calendar`)}
                    />
                    {canManage(ws.role) && (
                      <WsSubLink
                        href={`/w/${ws.id}/settings`}
                        icon={<Settings size={11} />}
                        label="Ustawienia"
                        active={pathname.startsWith(`/w/${ws.id}/settings`)}
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {workspaces.length === 0 && (
            <div className="px-2 py-3 text-[0.82rem] text-muted-foreground">
              {!collapsed && "Brak przestrzeni. Utwórz pierwszą."}
            </div>
          )}
        </div>
      </div>

      {/* Bottom: settings + signout */}
      <div className="flex flex-col gap-0.5 border-t border-sidebar-border px-2 py-2">
        {user.isSuperAdmin && (
          <NavItem
            href="/admin"
            icon={<ShieldCheck size={15} />}
            label="Panel admina"
            pathname={pathname}
            collapsed={collapsed}
          />
        )}
        <NavItem
          href="/profile"
          icon={<Settings size={15} />}
          label="Ustawienia konta"
          pathname={pathname}
          collapsed={collapsed}
        />
        {/* F12-K15: prominent labeled theme toggle obok 'Wyloguj' — wcześniej
            był w nagłówku sidebar jako mała ikonka, klient nie widział że
            istnieje. */}
        <ThemeToggle variant="labeled" collapsed={collapsed} />
        <form action={signOutAction} className="w-full">
          <button
            type="submit"
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-[0.88rem] text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
          >
            <LogOut size={15} className="shrink-0" />
            {!collapsed && <span className="truncate">Wyloguj</span>}
          </button>
        </form>
      </div>
    </aside>
    </>
  );
}

// F12-K19: workspace pod-link (Wiki/Support/Creative Board/Kalendarz/
// Ustawienia) — taki sam wygląd co dotąd, ale z active state'em żeby
// klient widział na czym aktualnie jest. Active = żywy text-foreground
// + sidebar-accent tło + lewy primary marker.
function WsSubLink({
  href,
  icon,
  label,
  active,
  badge,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  active: boolean;
  // F12-K38: opcjonalny licznik (np. otwarte zgłoszenia supportu).
  badge?: number;
}) {
  return (
    <Link
      href={href}
      data-active={active ? "true" : "false"}
      className="group relative inline-flex items-center gap-1.5 rounded-sm px-2 py-1 font-mono text-[0.78rem] uppercase tracking-[0.12em] text-muted-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:font-semibold data-[active=true]:text-foreground"
    >
      {active && (
        <span
          aria-hidden
          className="absolute -left-[18px] top-1 bottom-1 w-[2px] bg-primary"
        />
      )}
      {icon} {label}
      {badge !== undefined && badge > 0 && (
        <span className="ml-auto grid h-4 min-w-[16px] place-items-center rounded-full bg-primary px-1 font-mono text-[0.58rem] font-bold tracking-normal text-primary-foreground">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </Link>
  );
}

function NavItem({
  href,
  icon,
  label,
  pathname,
  collapsed,
  disabled,
  hint,
  exact,
  badge,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  pathname: string;
  collapsed: boolean;
  disabled?: boolean;
  hint?: string;
  exact?: boolean;
  badge?: number;
}) {
  const active = exact ? pathname === href : pathname.startsWith(href);

  const content = (
    <>
      <span className="relative shrink-0 text-muted-foreground group-hover:text-foreground group-data-[active=true]:text-foreground">
        {icon}
        {collapsed && badge !== undefined && badge > 0 && (
          // Fixed width: badge never changes size when count jumps
          // 1 → 9 → 9+, so the icon row doesn't reflow.
          <span className="absolute -right-2 -top-1.5 grid h-4 w-4 place-items-center rounded-full bg-primary font-mono text-[0.55rem] font-bold text-primary-foreground">
            {badge > 9 ? "9+" : badge}
          </span>
        )}
      </span>
      {!collapsed && (
        <span className="min-w-0 flex-1 truncate tracking-tight">{label}</span>
      )}
      {!collapsed && badge !== undefined && badge > 0 && (
        <span className="grid h-5 w-6 shrink-0 place-items-center rounded-full bg-primary font-mono text-[0.62rem] font-bold text-primary-foreground">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
      {!collapsed && hint && badge === undefined && (
        <span className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-muted-foreground/60">
          {hint}
        </span>
      )}
    </>
  );

  const cls =
    "group flex items-center gap-2 rounded-sm px-2 py-1.5 text-[0.88rem] data-[active=true]:bg-sidebar-accent data-[active=true]:text-foreground";

  if (disabled) {
    return (
      <span
        data-active={active ? "true" : "false"}
        className={`${cls} cursor-not-allowed text-muted-foreground/60`}
        title={hint ? `Dostępne w ${hint}` : undefined}
      >
        {content}
      </span>
    );
  }

  return (
    <Link
      href={href}
      data-active={active ? "true" : "false"}
      className={`${cls} text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground`}
    >
      {content}
    </Link>
  );
}

function canManage(role: Role): boolean {
  return role === "ADMIN";
}

// F12-K52: tworzenie tablic dostępne dla ADMIN + MEMBER (zgodnie z lib/permissions
// matrix). Wcześniej canManage blokowało wszystkich poza ADMIN'em — bug.
function canCreateBoard(role: Role): boolean {
  return role === "ADMIN" || role === "MEMBER";
}
