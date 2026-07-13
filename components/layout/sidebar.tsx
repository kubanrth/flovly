"use client";

// F12-K81 (v4 sidebar refactor): pełen visual refresh do FLOVLY Brand v4.
//  • 210px floating glass card (vs poprzednie 252px) — matchuje v4 hero mock.
//  • Sekcjonowanie: eyebrow labels ("Twoje" / "Przestrzenie") nad każdą grupą.
//  • Brand mark (FlovlyMark 32px) + wordmark FLOVLY w headerze.
//  • Workspace swatches w v4 stylu (rounded-lg z gradient'em + soft shadow).
//  • User profile widget = sub-card na dole z border + glass tint.
//  • Active state: gradient brand tint (rgba(122,51,236,.12) → rgba(225,49,143,.1)).
//
// Zachowane 100%: dnd-kit workspace + board reorder, collapse toggle,
// mobile drawer (slide-in, backdrop, body scroll lock, Esc close),
// ThemeToggle, path-based active state, wszystkie linki + ikonki.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { startTransition, useEffect, useState } from "react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Bell,
  BookOpen,
  Briefcase,
  FileText,
  GripVertical,
  LifeBuoy,
  CalendarDays,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Compass,
  Inbox,
  Layers,
  LineChart,
  KeyRound,
  Clock,
  Menu,
  Plane,
  Plus,
  Settings,
  StickyNote,
  X,
} from "lucide-react";
import type { Role } from "@/lib/generated/prisma/enums";
import { reorderWorkspacesAction } from "@/app/(app)/workspaces/actions";
import { FlovlyMark, FlovlyWordmark } from "@/components/brand/flovly-logo";
import { reorderBoardsAction } from "@/app/(app)/w/[workspaceId]/b/actions";
import { CreateBoardDialog } from "@/components/workspaces/create-board-dialog";
import { DeleteBoardDialog } from "@/components/workspaces/delete-board-dialog";
import { ProfileDropdown } from "@/components/profile/profile-dropdown";
import {
  WorkspaceSwitcher,
  type WorkspaceSwitcherItem,
} from "@/components/workspaces/workspace-switcher";

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
  // Count of OPEN + IN_PROGRESS support tickets (excludes RESOLVED/CLOSED).
  openSupportCount?: number;
}

// Bumped v2 to ignore stale localStorage from prior sessions; users start expanded.
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
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    new Set(activeWorkspaceId ? [activeWorkspaceId] : []),
  );

  // Optimistic local order; useEffect re-syncs after revalidatePath from server action.
  const [workspaceItems, setWorkspaceItems] = useState(workspaces);
  useEffect(() => {
    setWorkspaceItems(workspaces);
  }, [workspaces]);

  const sensors = useSensors(
    // 5px threshold — clicks under it pass through to <Link>; no accidental drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onWorkspaceDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setWorkspaceItems((prev) => {
      const oldIdx = prev.findIndex((w) => w.id === active.id);
      const newIdx = prev.findIndex((w) => w.id === over.id);
      if (oldIdx < 0 || newIdx < 0) return prev;
      const next = arrayMove(prev, oldIdx, newIdx);
      const orderedIds = next.map((w) => w.id);
      startTransition(() => {
        void reorderWorkspacesAction(orderedIds);
      });
      return next;
    });
  };

  // Auto-close mobile drawer on route change.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  // Block body scroll while mobile drawer is open.
  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

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
      {/* Mobile hamburger — z-[90] === Z.mobileNav (F12-K104).
          Nad NotificationToaster + ReminderPopups (z-[80] toast), pod
          modal/drawer (z-[100]/[110]) — drawer ma się nakładać nad hamburger,
          inaczej klient nie może zamknąć drawer'a. */}
      {!mobileOpen && (
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Otwórz menu"
          className="mobile-sidebar-toggle fixed right-3 top-3 z-[90] grid h-11 w-11 place-items-center rounded-lg border border-border bg-card/95 text-foreground shadow-lg backdrop-blur transition-colors hover:bg-accent md:hidden"
        >
          <Menu size={20} />
        </button>
      )}

      <aside
        data-collapsed={collapsed ? "true" : "false"}
        data-mobile-open={mobileOpen ? "true" : "false"}
        // Dual-mode: mobile drawer (max-md) vs desktop sticky (md+). Mobile rules MUST use `max-md:` —
        // otherwise data-[mobile-open=false]:-translate-x-full (specificity 0,2,0) beats md:translate-x-0
        // (0,1,0) and the sidebar stays hidden on desktop.
        // v4: 240px expanded (210 ciął "Wszystkie przestrzenie"), 72px collapsed (icon-only).
        className="group/sidebar flex h-dvh flex-col text-sidebar-foreground transition-[transform,width] duration-200 max-md:fixed max-md:inset-0 max-md:z-40 max-md:w-full max-md:p-0 max-md:data-[mobile-open=false]:-translate-x-full max-md:data-[mobile-open=true]:translate-x-0 md:sticky md:top-0 md:self-start md:p-3 md:pr-2 data-[collapsed=true]:md:w-[72px] data-[collapsed=false]:md:w-[240px]"
      >
        {/* Mobile: cały sidebar scrolluje jako jedna kolumna (max-md:overflow-y-auto)
            żeby user nie był zamknięty w zagnieżdżonym scroll'u listy workspace'ów.
            Desktop: zewnętrzny overflow-hidden, wewnętrzna sekcja workspace'ów ma
            własny scroll bo header i footer mają trzymać się na top/bottom. */}
        {/* F12-K85 perf: usunięty backdrop-blur-[40px] saturate-[1.8] —
            sidebar jest ZAWSZE widoczny + przy każdym hover/scroll repaint
            kosztował tysiące ms na slabszych GPU (klient raportuje zamulę).
            Background z .sidebar-glass utility wystarczy dla v4 vibe'u. */}
        <div className="sidebar-glass relative flex h-full flex-col md:overflow-hidden max-md:overflow-y-auto md:rounded-[22px] max-md:rounded-none max-md:border-0">

          {/* ─── HEADER: brand mark + wordmark + collapse/close toggle ─── */}
          {/* v4: padding 14px wewnątrz, brand mark 28px (gradient square + chevron). */}
          <div
            className={`relative flex items-center gap-2.5 border-b border-black/5 dark:border-white/[0.05] px-3.5 py-3.5 max-md:px-5 max-md:py-4 ${
              collapsed ? "justify-center" : "justify-between"
            }`}
          >
            <Link
              href="/workspaces"
              className={`flex min-w-0 items-center gap-2.5 rounded-md transition-opacity hover:opacity-80 ${
                collapsed ? "" : "flex-1"
              }`}
              title="Flovly — strona główna"
            >
              <FlovlyMark size={collapsed ? 30 : 28} />
              {!collapsed && (
                <FlovlyWordmark size="sm" gradientV={false} className="!text-[18px]" />
              )}
            </Link>
            {!collapsed && (
              <div className="flex shrink-0 items-center gap-1">
                {/* Mobile close X — 44px tap target (Apple HIG min); only way to close drawer on mobile besides Esc. */}
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-black/5 dark:hover:bg-white/[0.05] hover:text-foreground md:hidden"
                  aria-label="Zamknij menu"
                >
                  <X size={20} />
                </button>
                <button
                  type="button"
                  onClick={() => setCollapsed((v) => !v)}
                  className="hidden h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-black/5 dark:hover:bg-white/[0.05] hover:text-foreground md:grid"
                  aria-label="Zwiń panel"
                >
                  <ChevronLeft size={14} />
                </button>
              </div>
            )}
            {/* W trybie collapsed chevron jest poniżej (centered) — inaczej zachodzi na logo. */}
          </div>
          {collapsed && (
            <div className="hidden justify-center border-b border-black/5 px-2 py-2 dark:border-white/[0.05] md:flex">
              <button
                type="button"
                onClick={() => setCollapsed(false)}
                className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-black/5 hover:text-foreground dark:hover:bg-white/[0.05]"
                aria-label="Rozwiń panel"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          )}

          {/* ─── SEKCJA "TWOJE" — personal nav items ─── */}
          <div className="border-b border-black/5 px-3 pb-2 pt-3 dark:border-white/[0.05] max-md:px-4 max-md:pt-4">
            {!collapsed && (
              <div className="mb-2 px-1.5">
                <span className="eyebrow max-md:text-[0.78rem] max-md:tracking-[0.12em]">
                  Twoje
                </span>
              </div>
            )}
            <nav className="flex flex-col gap-1">
              <NavItem
                href="/inbox"
                icon={<Inbox size={16} />}
                label="Powiadomienia"
                pathname={pathname}
                collapsed={collapsed}
                badge={unreadNotificationCount > 0 ? unreadNotificationCount : undefined}
              />
              <NavItem
                href="/my-tasks"
                icon={<Compass size={16} />}
                label="Zadania dla Ciebie"
                pathname={pathname}
                collapsed={collapsed}
              />
              <NavItem
                href="/my/todo"
                icon={<CheckSquare size={16} />}
                label="TO DO"
                pathname={pathname}
                collapsed={collapsed}
              />
              <NavItem
                href="/my/calendar"
                icon={<CalendarDays size={16} />}
                label="Kalendarz"
                pathname={pathname}
                collapsed={collapsed}
              />
              <NavItem
                href="/my/notes"
                icon={<StickyNote size={16} />}
                label="Notatnik"
                pathname={pathname}
                collapsed={collapsed}
              />
              <NavItem
                href="/my/reminders"
                icon={<Bell size={16} />}
                label="Przypomnienia"
                pathname={pathname}
                collapsed={collapsed}
              />
              <NavItem
                href="/vacations"
                icon={<Plane size={16} />}
                label="Urlopy"
                pathname={pathname}
                collapsed={collapsed}
              />
              <NavItem
                href="/workspaces"
                icon={<Layers size={16} />}
                label="Wszystkie przestrzenie"
                pathname={pathname}
                collapsed={collapsed}
                exact
              />
            </nav>
          </div>

          {/* ─── SEKCJA "PRZESTRZENIE" — workspaces list + DnD reorder ─── */}
          {/* Na mobile DZIELI scroll z resztą sidebar'a; na desktopie nested scroll.
              F12-K83: Header "Przestrzenie" jest teraz triggerem do WorkspaceSwitcher
              popover (quick-switch); pełna lista poniżej pozostaje (DnD + boards). */}
          <div className="px-3 pb-2 pt-3 md:flex-1 md:overflow-y-auto max-md:px-4 max-md:pt-4">
            {!collapsed && (
              <div className="mb-2 flex items-center justify-between px-1.5 max-md:mb-3">
                <WorkspaceSwitcher
                  workspaces={workspaceItems.map(
                    (w): WorkspaceSwitcherItem => ({
                      id: w.id,
                      name: w.name,
                      role: w.role,
                    }),
                  )}
                  activeWorkspaceId={activeWorkspaceId}
                >
                  <span className="inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 transition-colors hover:bg-black/5 dark:hover:bg-white/[0.05]">
                    <span className="eyebrow max-md:text-[0.78rem] max-md:tracking-[0.12em]">
                      Przestrzenie
                    </span>
                    <ChevronDown
                      size={11}
                      className="text-muted-foreground/60"
                    />
                  </span>
                </WorkspaceSwitcher>
                <Link
                  href="/workspaces"
                  aria-label="Nowa przestrzeń"
                  className="grid h-5 w-5 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-black/5 dark:hover:bg-white/[0.05] hover:text-foreground max-md:h-10 max-md:w-10"
                >
                  <Plus size={13} className="max-md:size-[18px]" />
                </Link>
              </div>
            )}
            <div className="flex flex-col gap-1">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={onWorkspaceDragEnd}
              >
                <SortableContext
                  items={workspaceItems.map((w) => w.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {workspaceItems.map((ws) => (
                    <SortableWorkspaceRow
                      key={ws.id}
                      workspace={ws}
                      pathname={pathname}
                      activeWorkspaceId={activeWorkspaceId}
                      expanded={expandedIds.has(ws.id)}
                      onToggle={() => toggleWorkspace(ws.id)}
                      collapsed={collapsed}
                    />
                  ))}
                </SortableContext>
              </DndContext>
              {workspaceItems.length === 0 && !collapsed && (
                <div className="px-2 py-3 text-[0.82rem] text-muted-foreground">
                  Brak przestrzeni. Utwórz pierwszą.
                </div>
              )}
            </div>
          </div>

          {/* ─── FOOTER: user widget (klik → ProfileDropdown z Panel admina /
              Ustawienia / Powiadomienia / 2FA / Sesje / Tryb / Wyloguj).
              4 stare itemy footera (admin/settings/theme/logout) przeniesione do
              dropdownu — żeby workspace list dostała pełną wysokość. */}
          <div className="border-t border-black/5 dark:border-white/[0.05] max-md:px-4 max-md:pt-2">

            {/* User profile widget — sub-card z glass tint + border (v4 mock). */}
            <div className="px-3 pb-3 pt-1 max-md:px-4 max-md:pb-4">
              <ProfileDropdown
                user={{
                  email: user.email,
                  name: user.name,
                  avatarUrl: user.avatarUrl,
                  isSuperAdmin: user.isSuperAdmin,
                }}
              >
                <span
                  className={`flex items-center gap-2.5 rounded-[13px] border border-white/70 bg-white/55 p-2 transition-colors hover:bg-white/70 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/[0.08] ${
                    collapsed ? "justify-center" : ""
                  } max-md:gap-3.5 max-md:p-3`}
                >
                  <span
                    style={{ background: "linear-gradient(140deg, #34BEF8, #7C5CFF)" }}
                    className="relative grid h-[30px] w-[30px] shrink-0 place-items-center overflow-hidden rounded-[9px] font-display text-[0.72rem] font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_4px_12px_-4px_rgba(124,92,255,0.45)] max-md:h-11 max-md:w-11 max-md:rounded-[12px] max-md:text-[0.95rem]"
                  >
                    {user.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={user.avatarUrl} alt="" width={30} height={30} className="h-full w-full object-cover" />
                    ) : (
                      initials
                    )}
                  </span>
                  {!collapsed && (
                    <div className="min-w-0 flex-1 leading-tight">
                      <div className="truncate text-[0.78rem] font-semibold tracking-[-0.005em] text-foreground max-md:text-[1rem]">
                        {user.name ?? user.email.split("@")[0]}
                      </div>
                      <div className="truncate text-[0.68rem] text-muted-foreground max-md:text-[0.78rem]">
                        {user.isSuperAdmin ? "Owner" : "Member"}
                      </div>
                    </div>
                  )}
                </span>
              </ProfileDropdown>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

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
  badge?: number;
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      data-active={active ? "true" : "false"}
      className="group relative inline-flex items-center gap-2 rounded-md px-2 py-1 font-mono text-[0.7rem] uppercase tracking-[0.12em] text-muted-foreground/80 transition-colors hover:bg-black/5 dark:hover:bg-white/[0.05] hover:text-foreground data-[active=true]:bg-white/80 data-[active=true]:shadow-[0_0_0_0.5px_rgba(12,13,18,0.08),inset_0_1px_0_rgba(255,255,255,0.9),0_1px_2px_rgba(12,13,18,0.04)] dark:data-[active=true]:bg-white/[0.07] dark:data-[active=true]:shadow-[inset_0_0_0_0.5px_rgba(255,255,255,0.10),inset_0_1px_0_rgba(255,255,255,0.06)] data-[active=true]:font-semibold data-[active=true]:text-foreground max-md:gap-2.5 max-md:px-3 max-md:py-2.5 max-md:text-[0.86rem] [&>svg]:max-md:size-4"
    >
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
      <span className="relative shrink-0 text-muted-foreground transition-colors group-hover:text-foreground group-data-[active=true]:text-foreground [&>svg]:max-md:size-[18px]">
        {icon}
        {collapsed && badge !== undefined && badge > 0 && (
          // Fixed width — badge size stable across 1 → 9 → 9+ so icon row doesn't reflow.
          <span className="absolute -right-2 -top-1.5 grid h-4 w-4 place-items-center rounded-full bg-primary font-mono text-[0.55rem] font-bold text-primary-foreground">
            {badge > 9 ? "9+" : badge}
          </span>
        )}
      </span>
      {!collapsed && (
        <span className="min-w-0 flex-1 truncate tracking-tight">{label}</span>
      )}
      {!collapsed && badge !== undefined && badge > 0 && (
        <span className="grid h-5 min-w-[24px] place-items-center rounded-full bg-primary px-1.5 font-mono text-[0.62rem] font-bold text-primary-foreground">
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

  // v4: gap-2.5, padding 2.5/2 (vs poprzednie 2/1.5), rounded-lg (vs rounded-sm),
  // font-medium (vs default), text size 0.84rem (vs 0.88rem) — bardziej zwarte.
  // Collapsed (72px): icon wyśrodkowany w buttonie (justify-center + px-0) —
  // tak żeby wszystkie nav items miały spójną pozycję ikon w columnie 72px.
  const cls =
    `group flex items-center gap-2.5 rounded-lg py-2 text-[0.84rem] font-medium transition-colors data-[active=true]:bg-[linear-gradient(135deg,rgba(124,92,255,0.14),rgba(210,71,181,0.10))] data-[active=true]:shadow-[inset_0_0_0_1px_rgba(124,92,255,0.18),0_1px_2px_rgba(12,13,18,0.04)] data-[active=true]:text-foreground dark:data-[active=true]:bg-[linear-gradient(135deg,rgba(155,107,242,0.28),rgba(225,49,143,0.18))] dark:data-[active=true]:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)] dark:data-[active=true]:text-white max-md:gap-3 max-md:rounded-md max-md:px-3 max-md:py-3 max-md:text-[1rem] ${
      collapsed ? "justify-center px-0" : "px-2.5"
    }`;

  if (disabled) {
    // F12-K104: aria-disabled + role="link" — SR users dostają informację
    // że link jest niedostępny (cursor-not-allowed sam nie wystarcza).
    return (
      <span
        data-active={active ? "true" : "false"}
        role="link"
        aria-disabled="true"
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
      className={`${cls} text-sidebar-foreground hover:bg-black/5 dark:hover:bg-white/[0.05] hover:text-foreground`}
    >
      {content}
    </Link>
  );
}

function canManage(role: Role): boolean {
  return role === "ADMIN";
}

// Matches lib/permissions matrix — ADMIN + MEMBER can create boards (VIEWER cannot).
function canCreateBoard(role: Role): boolean {
  return role === "ADMIN" || role === "MEMBER";
}

// Inline style instead of Tailwind classes — dynamic class arrays aren't picked up by Tailwind v4 JIT.
const SWATCH_GRADIENTS: ReadonlyArray<readonly [string, string]> = [
  ["#7C5CFF", "#D247B5"], // brand violet → magenta (v4 primary)
  ["#34BEF8", "#7C5CFF"], // sky → violet
  ["#34BEF8", "#10B981"], // sky → emerald
  ["#F59E0B", "#E1318F"], // amber → magenta
  ["#A5B4FC", "#6366F1"], // periwinkle → indigo
  ["#F0ABFC", "#C084FC"], // pink → purple
];

function swatchIndex(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % SWATCH_GRADIENTS.length;
}

// v4: workspace swatch jest większy (20px → matchuje hero mock'i),
// rounded-lg, z gradient'em + inset highlight + soft shadow.
function WorkspaceSwatch({ id }: { id: string }) {
  const [from, to] = SWATCH_GRADIENTS[swatchIndex(id)];
  return (
    <span
      aria-hidden
      style={{ background: `linear-gradient(140deg, ${from}, ${to})` }}
      className="block h-5 w-5 shrink-0 rounded-[7px] shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_2px_6px_-2px_rgba(0,0,0,0.25)] max-md:h-[22px] max-md:w-[22px]"
    />
  );
}

// Drag handle is hover-only (desktop) / always (mobile); {...listeners} sits on the button so name clicks remain link clicks.
function SortableWorkspaceRow({
  workspace: ws,
  pathname,
  activeWorkspaceId,
  expanded,
  onToggle,
  collapsed,
}: {
  workspace: SidebarWorkspace;
  pathname: string;
  activeWorkspaceId: string | null;
  expanded: boolean;
  onToggle: () => void;
  collapsed: boolean;
}) {
  // Drag disabled when collapsed — no room for the grip handle next to narrow icons.
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: ws.id, disabled: collapsed });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : "auto",
  } as const;

  const isInWorkspace = ws.id === activeWorkspaceId;
  // Workspace row highlighted only on workspace overview / sub-links — board pages own the highlight.
  const onBoardInWs = pathname.startsWith(`/w/${ws.id}/b/`);
  const isActive = isInWorkspace && !onBoardInWs;

  return (
    <div ref={setNodeRef} style={style} className="flex flex-col">
      <div
        data-active={isActive ? "true" : "false"}
        className="group relative flex items-center gap-1 rounded-lg transition-colors data-[active=true]:bg-[linear-gradient(135deg,rgba(124,92,255,0.14),rgba(210,71,181,0.10))] data-[active=true]:shadow-[inset_0_0_0_1px_rgba(124,92,255,0.18),0_1px_2px_rgba(12,13,18,0.04)] dark:data-[active=true]:bg-[linear-gradient(135deg,rgba(155,107,242,0.28),rgba(225,49,143,0.18))] dark:data-[active=true]:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)]"
      >
        {!collapsed && (
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label="Przeciągnij przestrzeń"
            title="Przeciągnij aby zmienić kolejność"
            // display:none default (not opacity-0 + w-7 — that clipped the workspace name); group-hover:grid on desktop.
            className="hidden h-7 w-5 shrink-0 cursor-grab place-items-center rounded-md text-muted-foreground/60 transition-colors hover:text-foreground active:cursor-grabbing group-hover:grid max-md:!grid max-md:h-10 max-md:w-10 max-md:text-muted-foreground/50"
          >
            <GripVertical size={13} className="max-md:size-[16px]" />
          </button>
        )}
        <Link
          href={`/w/${ws.id}`}
          prefetch={false}
          className={`flex min-w-0 flex-1 items-center gap-2.5 rounded-lg py-2 text-[0.84rem] font-medium transition-colors hover:bg-black/5 dark:hover:bg-white/[0.05] max-md:gap-3 max-md:rounded-md max-md:px-3 max-md:py-3 max-md:text-[1rem] ${
            collapsed ? "justify-center px-0" : "px-2"
          }`}
        >
          <WorkspaceSwatch id={ws.id} />
          {!collapsed && (
            <span className="min-w-0 flex-1 truncate tracking-tight">
              {ws.name}
            </span>
          )}
        </Link>
        {!collapsed && canCreateBoard(ws.role) && (
          // Hover-only on desktop; permanently visible would clip the workspace name.
          <span className="hidden group-hover:inline-flex max-md:!inline-flex">
            <CreateBoardDialog
              workspaceId={ws.id}
              workspaceEnabledViews={ws.enabledViews}
            />
          </span>
        )}
        {!collapsed && (
          <button
            type="button"
            onClick={onToggle}
            className="grid h-7 w-6 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-black/5 dark:hover:bg-white/[0.05] hover:text-foreground max-md:h-11 max-md:w-11"
            aria-label={expanded ? "Zwiń" : "Rozwiń"}
            aria-expanded={expanded}
          >
            <ChevronDown
              size={13}
              className={`transition-transform max-md:size-[18px] ${expanded ? "rotate-0" : "-rotate-90"}`}
            />
          </button>
        )}
      </div>

      {!collapsed && expanded && (
        <SortableBoardsList
          workspaceId={ws.id}
          boards={ws.boards}
          pathname={pathname}
          role={ws.role}
          openSupportCount={ws.openSupportCount}
        />
      )}
    </div>
  );
}

// Per-workspace DndContext — no cross-workspace reorder; matches server action signature.
function SortableBoardsList({
  workspaceId,
  boards: boardsProp,
  pathname,
  role,
  openSupportCount,
}: {
  workspaceId: string;
  boards: { id: string; name: string }[];
  pathname: string;
  role: Role;
  openSupportCount?: number;
}) {
  const [boards, setBoards] = useState(boardsProp);
  useEffect(() => {
    setBoards(boardsProp);
  }, [boardsProp]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setBoards((prev) => {
      const oldIdx = prev.findIndex((b) => b.id === active.id);
      const newIdx = prev.findIndex((b) => b.id === over.id);
      if (oldIdx < 0 || newIdx < 0) return prev;
      const next = arrayMove(prev, oldIdx, newIdx);
      const orderedIds = next.map((b) => b.id);
      startTransition(() => {
        void reorderBoardsAction(workspaceId, orderedIds);
      });
      return next;
    });
  };

  // ADMIN + MEMBER only (matches reorderBoardsAction's requireWorkspaceAction("task.update")).
  const canDragBoards = canCreateBoard(role);

  return (
    <div className="mt-1 flex flex-col gap-0.5 pl-7">
      {boards.length === 0 && (
        <span className="px-2 py-1 font-mono text-[0.66rem] uppercase tracking-[0.14em] text-muted-foreground/70">
          brak tablic
        </span>
      )}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <SortableContext
          items={boards.map((b) => b.id)}
          strategy={verticalListSortingStrategy}
        >
          {boards.map((b) => (
            <SortableBoardRow
              key={b.id}
              workspaceId={workspaceId}
              board={b}
              pathname={pathname}
              role={role}
              canDrag={canDragBoards}
            />
          ))}
        </SortableContext>
      </DndContext>
      <WsSubLink
        href={`/w/${workspaceId}/wiki`}
        icon={<BookOpen size={11} />}
        label="Wiki"
        active={pathname.startsWith(`/w/${workspaceId}/wiki`)}
      />
      <WsSubLink
        href={`/w/${workspaceId}/support`}
        icon={<LifeBuoy size={11} />}
        label="Support"
        active={pathname.startsWith(`/w/${workspaceId}/support`)}
        badge={openSupportCount}
      />
      <WsSubLink
        href={`/w/${workspaceId}/briefs`}
        icon={<FileText size={11} />}
        label="Creative Board"
        active={pathname.startsWith(`/w/${workspaceId}/briefs`)}
      />
      <WsSubLink
        href={`/w/${workspaceId}/calendar`}
        icon={<CalendarDays size={11} />}
        label="Kalendarz"
        active={pathname.startsWith(`/w/${workspaceId}/calendar`)}
      />
      <WsSubLink
        href={`/w/${workspaceId}/contacts`}
        icon={<Briefcase size={11} />}
        label="Kontakty"
        active={pathname.startsWith(`/w/${workspaceId}/contacts`)}
      />
      <WsSubLink
        href={`/w/${workspaceId}/sales`}
        icon={<LineChart size={11} />}
        label="Plan sprzedaży"
        active={pathname.startsWith(`/w/${workspaceId}/sales`)}
      />
      {/* F12-K132: team password vault. */}
      <WsSubLink
        href={`/w/${workspaceId}/passwords`}
        icon={<KeyRound size={11} />}
        label="Hasła"
        active={pathname.startsWith(`/w/${workspaceId}/passwords`)}
      />
      {/* F12-K133: TimeCamp-like time tracking. */}
      <WsSubLink
        href={`/w/${workspaceId}/time`}
        icon={<Clock size={11} />}
        label="Czas pracy"
        active={pathname.startsWith(`/w/${workspaceId}/time`)}
      />
      {canManage(role) && (
        <WsSubLink
          href={`/w/${workspaceId}/settings`}
          icon={<Settings size={11} />}
          label="Ustawienia"
          active={pathname.startsWith(`/w/${workspaceId}/settings`)}
        />
      )}
    </div>
  );
}

function SortableBoardRow({
  workspaceId,
  board: b,
  pathname,
  role,
  canDrag,
}: {
  workspaceId: string;
  board: { id: string; name: string };
  pathname: string;
  role: Role;
  canDrag: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: b.id, disabled: !canDrag });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : "auto",
  } as const;

  const boardActive = pathname.startsWith(`/w/${workspaceId}/b/${b.id}`);

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-active={boardActive ? "true" : "false"}
      className="group relative flex items-center gap-1 rounded-md transition-colors data-[active=true]:bg-white/80 data-[active=true]:shadow-[0_0_0_0.5px_rgba(12,13,18,0.08),inset_0_1px_0_rgba(255,255,255,0.9),0_1px_2px_rgba(12,13,18,0.04)] dark:data-[active=true]:bg-white/[0.07] dark:data-[active=true]:shadow-[inset_0_0_0_0.5px_rgba(255,255,255,0.10),inset_0_1px_0_rgba(255,255,255,0.06)]"
    >
      {canDrag && (
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label="Przeciągnij tablicę"
          title="Przeciągnij aby zmienić kolejność"
          className="hidden h-6 w-6 shrink-0 cursor-grab place-items-center rounded-md text-muted-foreground/60 transition-colors hover:bg-black/5 dark:hover:bg-white/[0.05] hover:text-foreground active:cursor-grabbing group-hover:grid max-md:!grid max-md:h-9 max-md:w-9 max-md:text-muted-foreground/50"
        >
          <GripVertical size={12} className="max-md:size-[14px]" />
        </button>
      )}
      <Link
        href={`/w/${workspaceId}/b/${b.id}/table`}
        prefetch={false}
        className={`min-w-0 flex-1 truncate rounded-md px-2 py-1 text-[0.8rem] transition-colors hover:bg-black/5 dark:hover:bg-white/[0.05] hover:text-foreground max-md:px-3 max-md:py-2.5 max-md:text-[0.95rem] ${
          boardActive
            ? "font-semibold text-foreground"
            : "text-muted-foreground"
        }`}
      >
        {b.name}
      </Link>
      {canManage(role) && (
        <span className="hidden group-hover:inline-flex max-md:!inline-flex">
          <DeleteBoardDialog
            workspaceId={workspaceId}
            boardId={b.id}
            boardName={b.name}
          />
        </span>
      )}
    </div>
  );
}
