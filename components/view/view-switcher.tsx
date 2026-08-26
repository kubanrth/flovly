"use client";

// Redesign v5 (A2): underline tabs 40px (44 mobile, horizontal scroll),
// overflow → „Więcej N ▾" menu, custom views with ⋯ (Usuń), `+` slot.
// ponytail: tabs are <Link>s (real routing) styled like ui/Tab, not base-ui
// Tabs — AK24 wants the inset box-shadow underline and navigation per tab.

import { startTransition, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { deleteBoardViewAction } from "@/app/(app)/w/[workspaceId]/b/[boardId]/actions";
import type { ViewName } from "@/lib/board-views";
import { cn } from "@/lib/utils";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip } from "@/components/ui/tooltip";
import {
  IconBoards,
  IconCalendar,
  IconChevronDown,
  IconDoc,
  IconGrid,
  IconList,
  IconMore,
  IconRoadmap,
  IconTaskline,
  IconTimeline,
  IconTrash,
  IconWhiteboard,
} from "@/components/ui/icons";

export type { ViewName };

export interface CustomViewDescriptor {
  id: string;
  name: string;
  type: ViewName;
  path: string;
}

export const VIEW_LABEL: Record<ViewName, string> = {
  table: "Lista",
  kanban: "Tablica",
  gantt: "Oś czasu",
  roadmap: "Roadmapa",
  calendar: "Kalendarz",
  whiteboard: "Whiteboard",
  taskline: "Linia zadań",
};

export const VIEW_ICON: Record<ViewName, ReactNode> = {
  table: <IconList />,
  kanban: <IconBoards />,
  gantt: <IconTimeline />,
  roadmap: <IconRoadmap />,
  calendar: <IconCalendar />,
  whiteboard: <IconWhiteboard />,
  taskline: <IconTaskline />,
};

// A2 order. `/overview` = „Opis" (board doc), `/summary` = „Podsumowanie" (B8) —
// a read-only dashboard, so neither is a BoardView row.
const ORDER: ViewName[] = ["table", "kanban", "gantt", "roadmap", "calendar", "whiteboard", "taskline"];

interface TabItem {
  key: string;
  label: string;
  icon: ReactNode;
  href?: string;
  active: boolean;
  deleteId?: string;
}

const TAB =
  "inline-flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap px-2.5 text-sm font-medium text-muted-foreground no-underline outline-none hover:text-foreground active:text-foreground data-active:text-foreground data-active:shadow-[inset_0_-2px_0_var(--orange-500)] max-md:h-11 [&_svg]:size-3.5 [&_svg]:shrink-0";
const PLUS_W = 32;
const MORE_W = 96;

export function ViewSwitcher({
  workspaceId,
  boardId,
  active,
  activeViewId,
  enabled,
  customViews,
  canManage,
  defaultViewIds,
  addViewSlot,
}: {
  workspaceId: string;
  boardId: string;
  active?: ViewName;
  activeViewId?: string;
  size?: "sm" | "md";
  enabled?: ViewName[];
  customViews?: CustomViewDescriptor[];
  canManage?: boolean;
  defaultViewIds?: Partial<Record<ViewName, string>>;
  // `+` slot (32×40) rendered after the tabs — typically <CreateViewDialog />.
  addViewSlot?: ReactNode;
}) {
  const pathname = usePathname();
  const base = `/w/${workspaceId}/b/${boardId}`;
  const overviewActive = pathname === `${base}/overview` || !!pathname?.startsWith(`${base}/overview/`);
  const summaryActive = pathname === `${base}/summary`;
  const views = ORDER.filter((v) => !enabled || enabled.includes(v));
  const total = views.length + 1 + (customViews?.length ?? 0);

  const items: TabItem[] = [
    { key: "summary", label: "Podsumowanie", icon: <IconGrid />, href: `${base}/summary`, active: summaryActive },
    ...views.map((v) => {
      const isActive = !activeViewId && !overviewActive && !summaryActive && v === active;
      const id = defaultViewIds?.[v];
      return {
        key: `v:${v}`,
        label: VIEW_LABEL[v],
        icon: VIEW_ICON[v],
        href: `${base}/${v}`,
        active: isActive,
        deleteId: canManage && id && !isActive && total > 1 ? id : undefined,
      };
    }),
    { key: "overview", label: "Opis", icon: <IconDoc />, href: `${base}/overview`, active: overviewActive },
    ...(customViews ?? []).map((c) => ({
      key: `c:${c.id}`,
      label: c.name,
      icon: VIEW_ICON[c.type],
      href: c.path,
      active: activeViewId === c.id,
      deleteId: canManage ? c.id : undefined,
    })),
  ];

  // ── Overflow: measure once, fit as many tabs as the track allows ─────────
  const trackRef = useRef<HTMLDivElement>(null);
  const widths = useRef(new Map<string, number>());
  const [visible, setVisible] = useState(Infinity);
  const keys = items.map((i) => i.key).join("|");

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      if (window.innerWidth < 768) return setVisible(Infinity);
      el.querySelectorAll<HTMLElement>("[data-tab-key]").forEach((t) =>
        widths.current.set(t.dataset.tabKey ?? "", t.offsetWidth),
      );
      const w = (k: string) => widths.current.get(k) ?? MORE_W;
      const all = items.reduce((s, i) => s + w(i.key), 0) + PLUS_W;
      if (all <= el.clientWidth) return setVisible(Infinity);
      const avail = el.clientWidth - PLUS_W - MORE_W;
      let sum = 0;
      let n = 0;
      for (const i of items) {
        if (sum + w(i.key) > avail) break;
        sum += w(i.key);
        n++;
      }
      setVisible(Math.max(1, n));
    });
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys]);

  let shown = items;
  let hidden: TabItem[] = [];
  if (visible < items.length) {
    shown = items.slice(0, visible);
    hidden = items.slice(visible);
    const act = hidden.find((i) => i.active);
    if (act) {
      const last = shown[shown.length - 1];
      shown = [...shown.slice(0, -1), act];
      hidden = hidden.map((i) => (i === act ? last : i));
    }
  }

  // ←/→/Home/End between tabs (WAI-ARIA tabs pattern).
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    const tabs = Array.from(
      trackRef.current?.querySelectorAll<HTMLElement>('[role="tab"]:not([aria-disabled="true"])') ?? [],
    );
    const idx = tabs.indexOf(document.activeElement as HTMLElement);
    if (tabs.length === 0 || (idx === -1 && e.key.startsWith("Arrow"))) return;
    e.preventDefault();
    const next =
      e.key === "Home" ? 0
      : e.key === "End" ? tabs.length - 1
      : Math.min(tabs.length - 1, Math.max(0, idx + (e.key === "ArrowRight" ? 1 : -1)));
    tabs[next]?.focus();
  };

  const remove = (viewId: string) => {
    const fd = new FormData();
    fd.set("viewId", viewId);
    startTransition(() => deleteBoardViewAction(fd));
  };

  const renderTab = (t: TabItem) => {
    if (!t.href) {
      return (
        <Tooltip key={t.key} content="Wkrótce">
          <span role="tab" aria-disabled="true" data-tab-key={t.key} className={cn(TAB, "cursor-default text-n-400 hover:text-n-400")}>
            {t.icon}
            {t.label}
          </span>
        </Tooltip>
      );
    }
    const link = (
      <Link
        href={t.href}
        prefetch
        role="tab"
        aria-selected={t.active}
        data-active={t.active ? "" : undefined}
        data-tab-key={t.key}
        className={cn(TAB, t.deleteId && "pr-7")}
      >
        {t.icon}
        {t.label}
      </Link>
    );
    if (!t.deleteId) return <span key={t.key} className="contents">{link}</span>;
    return (
      <span key={t.key} className="group relative flex shrink-0">
        {link}
        <Menu>
          <MenuTrigger
            aria-label={`Opcje widoku ${t.label}`}
            className={cn(
              "absolute top-1/2 right-1 inline-flex size-5 -translate-y-1/2 items-center justify-center rounded-sm text-n-500 opacity-0 outline-none hover:bg-n-100 hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 data-popup-open:opacity-100 [&_svg]:size-3.5",
              t.active && "opacity-100",
            )}
          >
            <IconMore />
          </MenuTrigger>
          <MenuContent align="end">
            <MenuItem destructive icon={<IconTrash />} onClick={() => remove(t.deleteId!)}>
              Usuń widok
            </MenuItem>
          </MenuContent>
        </Menu>
      </span>
    );
  };

  return (
    <div data-ui="board-tabs" className="flex h-10 items-stretch border-b border-border px-6 max-md:h-11 max-md:px-4">
      <div
        ref={trackRef}
        role="tablist"
        aria-label="Widoki tablicy"
        onKeyDown={onKeyDown}
        className="no-scrollbar flex min-w-0 flex-1 items-stretch gap-0.5 max-md:overflow-x-auto"
      >
        {shown.map(renderTab)}
        {addViewSlot}
        {hidden.length > 0 && (
          <Menu>
            <MenuTrigger className={cn(TAB, "gap-[5px]")}>
              Więcej {hidden.length}
              <IconChevronDown width={12} height={12} />
            </MenuTrigger>
            <MenuContent align="end">
              {hidden.map((i) =>
                i.href ? (
                  <MenuItem key={i.key} icon={i.icon} render={<Link href={i.href} />}>
                    {i.label}
                  </MenuItem>
                ) : (
                  <MenuItem key={i.key} icon={i.icon} disabled>
                    {i.label}
                  </MenuItem>
                ),
              )}
            </MenuContent>
          </Menu>
        )}
      </div>
    </div>
  );
}
