"use client";

// Sidebar (redesign v5, A2/A3). Expanded 240px, rail 56px, mobile drawer 300px.
// Kept from v4: dnd-kit reorder of workspaces/boards + workspace ⋯ menu.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { startTransition, useEffect, useRef, useState, type ReactNode, type SVGProps } from "react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Role } from "@/lib/generated/prisma/client";
import { reorderWorkspacesAction } from "@/app/(app)/workspaces/actions";
import { reorderBoardsAction } from "@/app/(app)/w/[workspaceId]/b/actions";
import { Wordmark } from "@/components/brand/mark";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip } from "@/components/ui/tooltip";
import {
  IconBell,
  IconBoards,
  IconCalendar,
  IconChevronRight,
  IconClose,
  IconContacts,
  IconCreative,
  IconGrid,
  IconMore,
  IconNotes,
  IconPasswords,
  IconPlus,
  IconRecent,
  IconReminders,
  IconSales,
  IconSettings,
  IconShield,
  IconSliders,
  IconStar,
  IconSubscriptions,
  IconSupport,
  IconTasks,
  IconTodo,
  IconUsers,
  IconVacations,
  IconWhiteboard,
  IconWiki,
} from "@/components/ui/icons";
import { useUiPref } from "@/hooks/use-ui-pref";
import { cn } from "@/lib/utils";
import { AvatarMenu } from "./avatar-menu";
import { CustomizeSidebarDialog, FOR_YOU_ITEMS, SIDEBAR_ITEMS_PREF, TOOL_ITEMS, type ForYouKey, type SidebarItemsPref, type ToolKey } from "./customize-sidebar-dialog";
import type { ShellUser, SidebarProps, SidebarWorkspace } from "./shell-types";

export type { SidebarWorkspace } from "./shell-types";

type IconType = (props: SVGProps<SVGSVGElement>) => ReactNode;
interface NavItem {
  key: string;
  label: string;
  href: string;
  icon: IconType;
  badge?: ReactNode;
}
// Recent / starred entries (localStorage ui:recent / ui:starred).
interface SavedItem {
  type: string;
  id: string;
  label: string;
  href: string;
}

const FOR_YOU_META: Record<ForYouKey, { href: string; icon: IconType }> = {
  inbox: { href: "/inbox", icon: IconBell },
  "my-tasks": { href: "/my-tasks", icon: IconTasks },
  todo: { href: "/my/todo", icon: IconTodo },
  calendar: { href: "/my/calendar", icon: IconCalendar },
  notes: { href: "/my/notes", icon: IconNotes },
  reminders: { href: "/my/reminders", icon: IconReminders },
  vacations: { href: "/vacations", icon: IconVacations },
};
// ponytail: no dedicated clock icon in icons.tsx — Czas pracy reuses IconRecent (clock) like the mockup.
const TOOL_META: Record<ToolKey, { path: string; icon: IconType }> = {
  contacts: { path: "contacts", icon: IconContacts },
  sales: { path: "sales", icon: IconSales },
  time: { path: "time", icon: IconRecent },
  passwords: { path: "passwords", icon: IconPasswords },
  subscriptions: { path: "subscriptions", icon: IconSubscriptions },
  briefs: { path: "briefs", icon: IconCreative },
  support: { path: "support", icon: IconSupport },
  wiki: { path: "wiki", icon: IconWiki },
  canvases: { path: "canvases", icon: IconWhiteboard },
};

const ROLE_LABEL: Record<Role, string> = { ADMIN: "Administrator", MEMBER: "Członek", VIEWER: "Obserwator" };

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
function canManage(role: Role) {
  return role === "ADMIN";
}
// Matches lib/permissions — ADMIN + MEMBER create/reorder boards (VIEWER cannot).
function canCreateBoard(role: Role) {
  return role === "ADMIN" || role === "MEMBER";
}
const noop = () => {};
// Drag listeners live on the <a> rows. After an activated drag dnd-kit stops the
// post-drop click at document capture (so React never sees it) but leaves the
// native anchor navigation — cancel it ourselves.
function markDragEnd() {
  const swallow = (e: MouseEvent) => e.preventDefault();
  document.addEventListener("click", swallow, { capture: true, once: true });
  window.setTimeout(() => document.removeEventListener("click", swallow, { capture: true }), 50);
}

type Props = Omit<SidebarProps, "mode" | "mobileOpen" | "onMobileClose"> & Partial<Pick<SidebarProps, "mode" | "mobileOpen" | "onMobileClose">>;

export function Sidebar({ user, workspaces, unreadNotificationCount, myTasksCount, mode = "expanded", mobileOpen = false, onMobileClose = noop }: Props) {
  const pathname = usePathname();
  const activeWsId = pathname.match(/^\/w\/([^/]+)/)?.[1] ?? null;
  const toolsWs = workspaces.find((w) => w.id === activeWsId) ?? workspaces[0];
  const [itemsPref, setItemsPref] = useUiPref<SidebarItemsPref>(SIDEBAR_ITEMS_PREF, { hidden: [] });
  const [recent, setRecent] = useUiPref<SavedItem[]>("ui:recent", []);
  const [starred] = useUiPref<SavedItem[]>("ui:starred", []);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const hidden = new Set(itemsPref.hidden);

  // Record visited boards in ui:recent (max 5). Reads storage directly so the
  // first visit doesn't clobber history before useUiPref hydrates.
  useEffect(() => {
    const m = pathname.match(/^\/w\/([^/]+)\/b\/([^/]+)/);
    if (!m) return;
    const ws = workspaces.find((w) => w.id === m[1]);
    const board = ws?.boards.find((b) => b.id === m[2]);
    if (!ws || !board) return;
    let cur: SavedItem[] = [];
    try {
      cur = JSON.parse(window.localStorage.getItem("ui:recent") ?? "[]") as SavedItem[];
    } catch {
      /* ignore */
    }
    if (cur[0]?.id === board.id) return;
    setRecent([{ type: "board", id: board.id, label: board.name, href: `/w/${ws.id}/b/${board.id}/table` }, ...cur.filter((r) => r.id !== board.id)].slice(0, 5));
  }, [pathname, workspaces, setRecent]);

  // Mobile drawer: close on route change (not on mount) + Esc, lock body scroll.
  const lastPath = useRef(pathname);
  useEffect(() => {
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    onMobileClose();
  }, [pathname, onMobileClose]);
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onMobileClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [mobileOpen, onMobileClose]);

  const forYou: NavItem[] = FOR_YOU_ITEMS.filter((i) => !hidden.has(i.key)).map((i) => ({
    ...i,
    ...FOR_YOU_META[i.key],
    badge:
      i.key === "inbox" && unreadNotificationCount > 0 ? <Badge tone="red">{unreadNotificationCount}</Badge>
      : i.key === "my-tasks" && myTasksCount > 0 ? <Badge tone="gray">{myTasksCount}</Badge>
      : undefined,
  }));
  const tools: NavItem[] = toolsWs
    ? TOOL_ITEMS.filter((i) => !hidden.has(i.key)).map((i) => ({
        ...i,
        href: `/w/${toolsWs.id}/${TOOL_META[i.key].path}`,
        icon: TOOL_META[i.key].icon,
        badge: i.key === "support" && toolsWs.openSupportCount > 0 ? <Badge tone="gray">{toolsWs.openSupportCount}</Badge> : undefined,
      }))
    : [];
  const more: NavItem[] = [
    { key: "workspaces", label: "Wszystkie przestrzenie", href: "/workspaces", icon: IconGrid },
    ...(user.isSuperAdmin ? [{ key: "admin", label: "Panel admina", href: "/admin", icon: IconShield }] : []),
  ];
  const displayName = user.name ?? user.email;
  const roleLabel = user.isSuperAdmin ? "Administrator" : toolsWs ? ROLE_LABEL[toolsWs.role] : "Członek";

  return (
    <>
      {mode === "rail" ? (
        <nav data-ui="sidebar-rail" aria-label="Nawigacja" className="hidden w-14 shrink-0 flex-col items-center border-r border-border bg-canvas py-2 md:flex">
          <div className="no-scrollbar flex min-h-0 w-full flex-1 flex-col items-center gap-0.5 overflow-y-auto">
            {forYou.map((i) => (
              <RailButton key={i.key} href={i.href} label={i.label} active={isActive(pathname, i.href)} dot={i.key === "inbox" && unreadNotificationCount > 0}>
                <i.icon />
              </RailButton>
            ))}
            <RailSep />
            {workspaces.map((ws) => (
              <RailButton key={ws.id} href={`/w/${ws.id}`} label={ws.name} active={ws.id === activeWsId}>
                <WsTile name={ws.name} size={18} />
              </RailButton>
            ))}
            <RailSep />
            {tools.map((i) => (
              <RailButton key={i.key} href={i.href} label={i.label} active={isActive(pathname, i.href)}>
                <i.icon />
              </RailButton>
            ))}
            <RailSep />
            {more.map((i) => (
              <RailButton key={i.key} href={i.href} label={i.label} active={isActive(pathname, i.href)}>
                <i.icon />
              </RailButton>
            ))}
          </div>
          <div className="flex shrink-0 flex-col items-center gap-1 pt-2">
            <RailButton label="Dostosuj pasek" onClick={() => setCustomizeOpen(true)}>
              <IconSliders />
            </RailButton>
            <AvatarMenu
              user={user}
              align="start"
              trigger={
                <button type="button" aria-label="Menu użytkownika" className="rounded-full outline-none">
                  <Avatar name={displayName} src={user.avatarUrl} size={28} />
                </button>
              }
            />
          </div>
        </nav>
      ) : (
        <aside data-ui="sidebar" className="hidden w-60 shrink-0 flex-col border-r border-border bg-canvas md:flex">
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            <Eyebrow className="h-[26px]">Dla Ciebie</Eyebrow>
            {forYou.map((i) => (
              <NavRow key={i.key} href={i.href} icon={i.icon} label={i.label} badge={i.badge} active={isActive(pathname, i.href)} />
            ))}
            {/* Route-owned section (D4 puts „Widoczne w kalendarzu" here). Empty
                on every other route, so it costs nothing to leave mounted. */}
            <div data-ui="sidebar-slot" />
            <div className="h-2" />
            <SavedGroup icon={IconRecent} label="Ostatnie" items={recent} pathname={pathname} />
            <SavedGroup icon={IconStar} label="Oznaczone gwiazdką" items={starred} pathname={pathname} />
            <div className="mt-1.5 flex h-[30px] items-end justify-between px-2">
              <span className="eyebrow">Przestrzenie</span>
              <Link href="/workspaces?new=1" aria-label="Nowa przestrzeń" className="grid size-5 place-items-center rounded-sm text-n-500 hover:bg-n-100 hover:text-foreground active:bg-n-200">
                <IconPlus />
              </Link>
            </div>
            <WorkspaceList workspaces={workspaces} pathname={pathname} activeWsId={activeWsId} />
            {tools.length > 0 && <Eyebrow className="mt-1.5 h-[30px]">Narzędzia</Eyebrow>}
            {tools.map((i) => (
              <NavRow key={i.key} href={i.href} icon={i.icon} label={i.label} badge={i.badge} active={isActive(pathname, i.href)} />
            ))}
            <Eyebrow className="mt-1.5 h-[30px]">Więcej</Eyebrow>
            {more.map((i) => (
              <NavRow key={i.key} href={i.href} icon={i.icon} label={i.label} active={isActive(pathname, i.href)} />
            ))}
            <NavRow icon={IconSliders} label="Dostosuj pasek" onClick={() => setCustomizeOpen(true)} />
          </div>
          <div className="flex h-[52px] shrink-0 items-center gap-2 border-t border-border px-3">
            <Avatar name={displayName} src={user.avatarUrl} size={28} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium leading-4 text-foreground">{displayName}</div>
              <div className="truncate text-2xs leading-[14px] text-muted-foreground">{roleLabel}</div>
            </div>
            <AvatarMenu user={user} align="end" trigger={<MoreButton className="size-7" />} />
          </div>
        </aside>
      )}

      {mobileOpen && (
        <MobileDrawer user={user} displayName={displayName} roleLabel={roleLabel} forYou={forYou} tools={tools} more={more} workspaces={workspaces} pathname={pathname} activeWsId={activeWsId} onClose={onMobileClose} onCustomize={() => setCustomizeOpen(true)} />
      )}

      <CustomizeSidebarDialog open={customizeOpen} onOpenChange={setCustomizeOpen} hidden={itemsPref.hidden} onSave={(hidden) => setItemsPref({ hidden })} />
    </>
  );
}

/* ---------- pieces ---------- */

function Eyebrow({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("eyebrow flex items-end px-2", className)}>{children}</div>;
}

function WsTile({ name, size }: { name: string; size: 16 | 18 }) {
  return (
    <span aria-hidden className={cn("grid shrink-0 place-items-center rounded-sm bg-orange-100 text-[9px] font-bold leading-none text-orange-800", size === 16 ? "size-4" : "size-[18px]")}>
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}

function MoreButton({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  // span, not <button>: AvatarMenu wraps the trigger in its own role=button.
  return (
    <span aria-label="Więcej" className={cn("grid shrink-0 place-items-center rounded-md text-n-500 outline-none hover:bg-n-100 hover:text-foreground active:bg-n-200", className)} {...props}>
      <IconMore />
    </span>
  );
}

function NavRow({
  href,
  onClick,
  icon: Icon,
  iconSize = 16,
  label,
  badge,
  active = false,
  indent = false,
  mobile = false,
  trailing,
  ariaExpanded,
}: {
  href?: string;
  onClick?: () => void;
  icon: IconType;
  iconSize?: 14 | 16;
  label: string;
  badge?: ReactNode;
  active?: boolean;
  indent?: boolean;
  mobile?: boolean;
  trailing?: ReactNode;
  ariaExpanded?: boolean;
}) {
  const cls = cn(
    "flex w-full items-center rounded-md text-left outline-none",
    mobile ? "h-11 gap-3 px-2.5 text-base text-foreground" : "h-8 gap-2 px-2 text-sm text-n-700",
    indent && (mobile ? "pl-[34px]" : "pl-[30px]"),
    active ? "bg-selected font-medium text-foreground shadow-[inset_2px_0_0_var(--orange-500)]" : "hover:bg-n-100 active:bg-n-200",
  );
  const inner = (
    <>
      <Icon width={iconSize} height={iconSize} className={cn("shrink-0", active ? "text-orange-700" : "text-n-500")} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {badge}
      {trailing}
    </>
  );
  if (href) {
    return (
      <Link href={href} prefetch={false} className={cls} aria-current={active ? "page" : undefined}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls} aria-expanded={ariaExpanded}>
      {inner}
    </button>
  );
}

function Chevron({ open, className }: { open: boolean; className?: string }) {
  return <IconChevronRight width={12} height={12} className={cn("shrink-0 text-n-500 transition-transform duration-150", open && "rotate-90", className)} />;
}

// Ostatnie / Oznaczone gwiazdką.
function SavedGroup({ icon, label, items, pathname, mobile = false }: { icon: IconType; label: string; items: SavedItem[]; pathname: string; mobile?: boolean }) {
  // Collapsed while empty (as in A2), open as soon as there is something to
  // show — until the user says otherwise.
  const [override, setOverride] = useState<boolean | null>(null);
  const open = override ?? items.length > 0;
  return (
    <>
      <NavRow icon={icon} label={label} mobile={mobile} onClick={() => setOverride(!open)} ariaExpanded={open} trailing={<Chevron open={open} />} />
      {open &&
        (items.length === 0 ? (
          <div className={cn("flex h-8 items-center text-xs text-muted-foreground", mobile ? "pl-[34px]" : "pl-[30px]")}>Brak</div>
        ) : (
          items.map((it) => <NavRow key={`${it.type}:${it.id}`} href={it.href} icon={IconBoards} iconSize={14} label={it.label} indent mobile={mobile} active={isActive(pathname, it.href)} />)
        ))}
    </>
  );
}

function RailSep() {
  return <span aria-hidden className="my-1.5 h-px w-6 shrink-0 bg-border" />;
}

function RailButton({ href, onClick, label, active = false, dot = false, children }: { href?: string; onClick?: () => void; label: string; active?: boolean; dot?: boolean; children: ReactNode }) {
  const cls = cn(
    "relative grid size-8 shrink-0 place-items-center rounded-md outline-none",
    active ? "bg-selected text-orange-700 shadow-[inset_2px_0_0_var(--orange-500)]" : "text-n-600 hover:bg-n-100 hover:text-foreground active:bg-n-200",
  );
  const inner = (
    <>
      {children}
      {dot && <span aria-hidden className="absolute top-[3px] right-[3px] size-2 rounded-full border-[1.5px] border-canvas bg-danger" />}
    </>
  );
  return (
    <Tooltip content={label} side="right">
      {href ? (
        <Link href={href} prefetch={false} aria-label={label} aria-current={active ? "page" : undefined} className={cls}>
          {inner}
        </Link>
      ) : (
        <button type="button" onClick={onClick} aria-label={label} className={cls}>
          {inner}
        </button>
      )}
    </Tooltip>
  );
}

/* ---------- workspaces (dnd-kit) ---------- */

function useSortSensors() {
  return useSensors(
    // 5px threshold — clicks under it pass through to <Link>.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
}

function WorkspaceList({ workspaces, pathname, activeWsId }: { workspaces: SidebarWorkspace[]; pathname: string; activeWsId: string | null }) {
  // Optimistic order; re-synced when server props change (revalidatePath).
  const [items, setItems] = useState(workspaces);
  const [prevWs, setPrevWs] = useState(workspaces);
  if (prevWs !== workspaces) {
    setPrevWs(workspaces);
    setItems(workspaces);
  }
  // Active workspace auto-expands on navigation; others toggle manually.
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(activeWsId ? [activeWsId] : []));
  const [seenWs, setSeenWs] = useState(activeWsId);
  if (seenWs !== activeWsId) {
    setSeenWs(activeWsId);
    if (activeWsId && !expanded.has(activeWsId)) setExpanded(new Set(expanded).add(activeWsId));
  }
  const sensors = useSortSensors();
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    markDragEnd();
    if (!over || active.id === over.id) return;
    const next = arrayMove(items, items.findIndex((w) => w.id === active.id), items.findIndex((w) => w.id === over.id));
    setItems(next);
    startTransition(() => void reorderWorkspacesAction(next.map((w) => w.id)));
  };
  if (items.length === 0) return <div className="px-2 py-1.5 text-xs text-muted-foreground">Brak przestrzeni</div>;
  return (
    <DndContext id="sidebar-workspaces" sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={items.map((w) => w.id)} strategy={verticalListSortingStrategy}>
        {items.map((ws) => (
          <WorkspaceRow
            key={ws.id}
            ws={ws}
            pathname={pathname}
            active={ws.id === activeWsId && !pathname.startsWith(`/w/${ws.id}/b/`)}
            expanded={expanded.has(ws.id)}
            onToggle={() =>
              setExpanded((prev) => {
                const next = new Set(prev);
                if (!next.delete(ws.id)) next.add(ws.id);
                return next;
              })
            }
          />
        ))}
      </SortableContext>
    </DndContext>
  );
}

function sortableStyle(transform: Parameters<typeof CSS.Transform.toString>[0], transition: string | undefined, dragging: boolean) {
  return { transform: CSS.Transform.toString(transform), transition, opacity: dragging ? 0.5 : 1, zIndex: dragging ? 10 : undefined };
}

function WorkspaceRow({ ws, pathname, active, expanded, onToggle }: { ws: SidebarWorkspace; pathname: string; active: boolean; expanded: boolean; onToggle: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: ws.id });
  const manage = canManage(ws.role);
  const create = canCreateBoard(ws.role);
  return (
    <div ref={setNodeRef} style={sortableStyle(transform, transition, isDragging)}>
      <div className={cn("group flex h-8 items-center gap-1.5 rounded-md px-2 text-sm", active ? "bg-selected shadow-[inset_2px_0_0_var(--orange-500)]" : "hover:bg-n-100")}>
        <button type="button" onClick={onToggle} aria-label={expanded ? "Zwiń tablice" : "Rozwiń tablice"} aria-expanded={expanded} className="-mx-1 grid size-7 shrink-0 place-items-center rounded-sm outline-none hover:bg-n-200">
          <Chevron open={expanded} />
        </button>
        <Link href={`/w/${ws.id}`} prefetch={false} {...attributes} {...listeners} role="link" draggable={false} className="flex min-w-0 flex-1 items-center gap-1.5 self-stretch font-medium text-foreground outline-none">
          <WsTile name={ws.name} size={16} />
          <span className="truncate">{ws.name}</span>
        </Link>
        {(manage || create) && (
          <Menu>
            <MenuTrigger aria-label="Menu przestrzeni" className="grid size-7 shrink-0 place-items-center rounded-sm text-n-500 opacity-0 outline-none group-hover:opacity-100 hover:bg-n-200 hover:text-foreground focus-visible:opacity-100 data-popup-open:opacity-100">
              <IconMore width={14} height={14} />
            </MenuTrigger>
            <MenuContent align="start" side="right">
              {manage && <MenuItem icon={<IconSettings />} render={<Link href={`/w/${ws.id}/settings`} />}>Ustawienia</MenuItem>}
              <MenuItem icon={<IconUsers />} render={<Link href={`/w/${ws.id}/members`} />}>Członkowie</MenuItem>
              {create && <MenuItem icon={<IconPlus />} render={<Link href={`/w/${ws.id}?new=board`} />}>Nowa tablica</MenuItem>}
            </MenuContent>
          </Menu>
        )}
      </div>
      {expanded && <BoardList ws={ws} pathname={pathname} />}
    </div>
  );
}

function BoardList({ ws, pathname }: { ws: SidebarWorkspace; pathname: string }) {
  const [boards, setBoards] = useState(ws.boards);
  const [prevBoards, setPrevBoards] = useState(ws.boards);
  if (prevBoards !== ws.boards) {
    setPrevBoards(ws.boards);
    setBoards(ws.boards);
  }
  const sensors = useSortSensors();
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    markDragEnd();
    if (!over || active.id === over.id) return;
    const next = arrayMove(boards, boards.findIndex((b) => b.id === active.id), boards.findIndex((b) => b.id === over.id));
    setBoards(next);
    startTransition(() => void reorderBoardsAction(ws.id, next.map((b) => b.id)));
  };
  if (boards.length === 0) return <div className="flex h-8 items-center pl-[30px] text-xs text-muted-foreground">Brak tablic</div>;
  return (
    <DndContext id={`sidebar-boards-${ws.id}`} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={boards.map((b) => b.id)} strategy={verticalListSortingStrategy}>
        {boards.map((b) => (
          <BoardRow key={b.id} wsId={ws.id} board={b} canDrag={canCreateBoard(ws.role)} active={pathname.startsWith(`/w/${ws.id}/b/${b.id}`)} />
        ))}
      </SortableContext>
    </DndContext>
  );
}

function BoardRow({ wsId, board, canDrag, active }: { wsId: string; board: { id: string; name: string }; canDrag: boolean; active: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: board.id, disabled: !canDrag });
  return (
    <Link
      ref={setNodeRef}
      style={sortableStyle(transform, transition, isDragging)}
      href={`/w/${wsId}/b/${board.id}/table`}
      prefetch={false}
      {...attributes}
      {...listeners}
      role="link"
      draggable={false}
     
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-8 items-center gap-2 rounded-md pr-2 pl-[30px] text-sm outline-none",
        active ? "bg-selected font-medium text-foreground shadow-[inset_2px_0_0_var(--orange-500)]" : "text-n-700 hover:bg-n-100 active:bg-n-200",
      )}
    >
      <IconBoards width={14} height={14} className={cn("shrink-0", active ? "text-orange-700" : "text-n-500")} />
      <span className="min-w-0 flex-1 truncate">{board.name}</span>
    </Link>
  );
}

/* ---------- mobile drawer ---------- */

function MobileDrawer({
  user,
  displayName,
  roleLabel,
  forYou,
  tools,
  more,
  workspaces,
  pathname,
  activeWsId,
  onClose,
  onCustomize,
}: {
  user: ShellUser;
  displayName: string;
  roleLabel: string;
  forYou: NavItem[];
  tools: NavItem[];
  more: NavItem[];
  workspaces: SidebarWorkspace[];
  pathname: string;
  activeWsId: string | null;
  onClose: () => void;
  onCustomize: () => void;
}) {
  const [openWs, setOpenWs] = useState<Set<string>>(() => new Set(activeWsId ? [activeWsId] : []));
  const [toolsOpen, setToolsOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  return (
    <div className="fixed inset-0 z-(--z-panel) md:hidden">
      <button type="button" aria-label="Zamknij menu" onClick={onClose} className="absolute inset-0 bg-scrim" />
      <div data-ui="mobile-drawer" role="dialog" aria-modal="true" aria-label="Menu" className="absolute inset-y-0 left-0 flex w-[300px] flex-col bg-card shadow-e2">
        <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border pr-2 pl-4">
          <Wordmark />
          <span className="flex-1" />
          <button type="button" onClick={onClose} aria-label="Zamknij menu" className="grid size-11 place-items-center rounded-md text-n-600 outline-none hover:bg-n-100 active:bg-n-200">
            <IconClose />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          <Eyebrow className="h-[26px] px-2.5">Dla Ciebie</Eyebrow>
          {forYou.map((i) => (
            <NavRow key={i.key} mobile href={i.href} icon={i.icon} label={i.label} badge={i.badge} active={isActive(pathname, i.href)} />
          ))}
          <div className="mt-1 flex h-[30px] items-end justify-between px-2.5">
            <span className="eyebrow">Przestrzenie</span>
            <Link href="/workspaces?new=1" aria-label="Nowa przestrzeń" className="grid size-6 place-items-center rounded-sm text-n-500 hover:bg-n-100 active:bg-n-200">
              <IconPlus />
            </Link>
          </div>
          {workspaces.map((ws) => {
            const open = openWs.has(ws.id);
            const wsActive = ws.id === activeWsId && !pathname.startsWith(`/w/${ws.id}/b/`);
            return (
              <div key={ws.id}>
                <div className={cn("flex h-11 items-center gap-2.5 rounded-md px-2.5 text-base", wsActive ? "bg-selected shadow-[inset_2px_0_0_var(--orange-500)]" : "hover:bg-n-100")}>
                  <button
                    type="button"
                    aria-label={open ? "Zwiń tablice" : "Rozwiń tablice"}
                    aria-expanded={open}
                    onClick={() =>
                      setOpenWs((prev) => {
                        const next = new Set(prev);
                        if (!next.delete(ws.id)) next.add(ws.id);
                        return next;
                      })
                    }
                    className="-mx-2 grid size-8 shrink-0 place-items-center rounded-sm outline-none"
                  >
                    <Chevron open={open} />
                  </button>
                  <Link href={`/w/${ws.id}`} prefetch={false} className="flex min-w-0 flex-1 items-center gap-2.5 self-stretch font-medium text-foreground outline-none">
                    <WsTile name={ws.name} size={18} />
                    <span className="truncate">{ws.name}</span>
                  </Link>
                </div>
                {open &&
                  ws.boards.map((b) => (
                    <NavRow key={b.id} mobile indent href={`/w/${ws.id}/b/${b.id}/table`} icon={IconBoards} iconSize={14} label={b.name} active={pathname.startsWith(`/w/${ws.id}/b/${b.id}`)} />
                  ))}
              </div>
            );
          })}
          <div className="h-1" />
          <NavRow mobile icon={IconSliders} label="Narzędzia" onClick={() => setToolsOpen((v) => !v)} ariaExpanded={toolsOpen} trailing={<Chevron open={toolsOpen} />} />
          {toolsOpen && tools.map((i) => <NavRow key={i.key} mobile indent href={i.href} icon={i.icon} label={i.label} badge={i.badge} active={isActive(pathname, i.href)} />)}
          <NavRow mobile icon={IconGrid} label="Więcej" onClick={() => setMoreOpen((v) => !v)} ariaExpanded={moreOpen} trailing={<Chevron open={moreOpen} />} />
          {moreOpen && (
            <>
              {more.map((i) => (
                <NavRow key={i.key} mobile indent href={i.href} icon={i.icon} label={i.label} active={isActive(pathname, i.href)} />
              ))}
              <NavRow mobile indent icon={IconSliders} label="Dostosuj pasek" onClick={onCustomize} />
            </>
          )}
        </div>
        <div className="flex h-[60px] shrink-0 items-center gap-2.5 border-t border-border px-4">
          <Avatar name={displayName} src={user.avatarUrl} size={32} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-base font-medium leading-[18px] text-foreground">{displayName}</div>
            <div className="truncate text-2xs leading-[14px] text-muted-foreground">{roleLabel}</div>
          </div>
          <AvatarMenu user={user} align="end" trigger={<MoreButton className="size-11" />} />
        </div>
      </div>
    </div>
  );
}
