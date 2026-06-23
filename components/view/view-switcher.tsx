"use client";

// F12-K88 (ViewSwitcher v5): liquid-glass single-row, zawsze 1 rząd niezależnie
// od liczby widoków. Track scrollowalny + gradient mask 22px na krawędziach +
// chevrony left/right (auto-enable gdy overflow). Active pill = gradient
// background + inner ring + brand-clip text + fl-pop spring animation.
// Keyboard ←/→ między pillami, focus-visible brand ring. Reduced-motion safe.

import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Table2,
  KanbanSquare,
  GitBranch,
  BarChart3,
  Calendar,
  Pencil,
  FileText,
  Workflow,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { deleteBoardViewAction } from "@/app/(app)/w/[workspaceId]/b/[boardId]/actions";
import type { ViewName } from "@/lib/board-views";

export type { ViewName };

interface ViewDescriptor {
  name: ViewName;
  label: string;
  icon: React.ReactNode;
  path: string;
}

export interface CustomViewDescriptor {
  id: string;
  name: string;
  type: ViewName;
  path: string;
}

const DEFAULT_ICONS: Record<ViewName, React.ReactNode> = {
  table: <Table2 size={15} />,
  kanban: <KanbanSquare size={15} />,
  roadmap: <GitBranch size={15} />,
  gantt: <BarChart3 size={15} />,
  calendar: <Calendar size={15} />,
  whiteboard: <Pencil size={15} />,
  taskline: <Workflow size={15} />,
};

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
  // Optional slot rendered INSIDE the frame, between track and right chevron.
  // Typically a `<CreateViewDialog />` styled with `.lg-vs-add-view`. Kept as
  // ReactNode so parent owns the trigger UI / dialog state.
  addViewSlot?: React.ReactNode;
}) {
  const pathname = usePathname();
  const overviewPath = `/w/${workspaceId}/b/${boardId}/overview`;
  const overviewActive =
    pathname === overviewPath || pathname?.startsWith(`${overviewPath}/`);

  const allViews: ViewDescriptor[] = [
    { name: "table", label: "Tabela", icon: DEFAULT_ICONS.table, path: `/w/${workspaceId}/b/${boardId}/table` },
    { name: "kanban", label: "Kanban", icon: DEFAULT_ICONS.kanban, path: `/w/${workspaceId}/b/${boardId}/kanban` },
    { name: "roadmap", label: "Roadmapa", icon: DEFAULT_ICONS.roadmap, path: `/w/${workspaceId}/b/${boardId}/roadmap` },
    { name: "gantt", label: "Gantt", icon: DEFAULT_ICONS.gantt, path: `/w/${workspaceId}/b/${boardId}/gantt` },
    { name: "calendar", label: "Kalendarz", icon: DEFAULT_ICONS.calendar, path: `/w/${workspaceId}/b/${boardId}/calendar` },
    { name: "whiteboard", label: "Whiteboard", icon: DEFAULT_ICONS.whiteboard, path: `/w/${workspaceId}/b/${boardId}/whiteboard` },
    { name: "taskline", label: "Linia zadań", icon: DEFAULT_ICONS.taskline, path: `/w/${workspaceId}/b/${boardId}/taskline` },
  ];

  const views = enabled ? allViews.filter((v) => enabled.includes(v.name)) : allViews;

  // ── Track scroll state ──────────────────────────────────────────────────
  const trackRef = useRef<HTMLDivElement>(null);
  const pillRefs = useRef<Map<string, HTMLElement>>(new Map());
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const setPillRef = useCallback(
    (key: string) => (el: HTMLElement | null) => {
      if (el) pillRefs.current.set(key, el);
      else pillRefs.current.delete(key);
    },
    [],
  );

  const updateChevrons = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    // 2px epsilon — rounded scroll math.
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }, []);

  useEffect(() => {
    updateChevrons();
    const el = trackRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateChevrons, { passive: true });
    const ro = new ResizeObserver(updateChevrons);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateChevrons);
      ro.disconnect();
    };
  }, [updateChevrons, views.length, customViews?.length]);

  // Auto-scroll active pill into view (gdy switch view ze skrótu klawiaturowego
  // albo route change).
  const activeKey = overviewActive
    ? "overview"
    : activeViewId
      ? `c:${activeViewId}`
      : active
        ? `v:${active}`
        : null;

  useEffect(() => {
    if (!activeKey) return;
    const pill = pillRefs.current.get(activeKey);
    if (!pill) return;
    pill.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [activeKey]);

  const scrollBy = (dx: number) => {
    trackRef.current?.scrollBy({ left: dx, behavior: "smooth" });
  };

  // Keyboard ←/→/Home/End między pillami (WAI-ARIA Tabs pattern).
  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (
      e.key !== "ArrowLeft" &&
      e.key !== "ArrowRight" &&
      e.key !== "Home" &&
      e.key !== "End"
    ) {
      return;
    }
    const track = trackRef.current;
    if (!track) return;
    const focusables = Array.from(
      track.querySelectorAll<HTMLElement>('[role="tab"]'),
    );
    if (focusables.length === 0) return;
    if (e.key === "Home") {
      e.preventDefault();
      focusables[0]?.focus();
      return;
    }
    if (e.key === "End") {
      e.preventDefault();
      focusables[focusables.length - 1]?.focus();
      return;
    }
    const idx = focusables.indexOf(document.activeElement as HTMLElement);
    if (idx === -1) return;
    e.preventDefault();
    const next = e.key === "ArrowLeft"
      ? Math.max(0, idx - 1)
      : Math.min(focusables.length - 1, idx + 1);
    focusables[next]?.focus();
  }, []);

  // ── Pill renderer ───────────────────────────────────────────────────────
  type PillProps = {
    key: string;
    href: string;
    icon: React.ReactNode;
    label: string;
    isActive: boolean;
    canDelete?: boolean;
    viewIdToDelete?: string;
    deleteLabel?: string;
  };

  const renderPill = (p: PillProps) => (
    <div key={p.key} className="group relative shrink-0">
      <Link
        href={p.href}
        prefetch
        ref={setPillRef(p.key)}
        role="tab"
        aria-selected={p.isActive}
        // ponytail: aria-controls points to a panel id rendered by the route
        // tree (different page wrapper per view) — id may not exist in DOM,
        // but the attribute still gives SRs the tab→panel relation semantically.
        aria-controls={`view-panel-${p.key.replace(/[:]/g, "-")}`}
        data-active={p.isActive ? "true" : "false"}
        className={`lg-vs-pill ${p.canDelete ? "pr-7" : ""}`}
      >
        {p.icon}
        <span className="lg-vs-label">{p.label}</span>
      </Link>
      {p.canDelete && p.viewIdToDelete && (
        <form
          action={(fd) => startTransition(() => deleteBoardViewAction(fd))}
          className="m-0 absolute right-1 top-1/2 -translate-y-1/2"
        >
          <input type="hidden" name="viewId" value={p.viewIdToDelete} />
          <button
            type="submit"
            aria-label={p.deleteLabel ?? `Usuń widok ${p.label}`}
            title={p.deleteLabel ?? `Usuń widok ${p.label} z tablicy`}
            className="grid h-4 w-4 place-items-center rounded-sm text-current opacity-0 transition-opacity hover:bg-destructive/20 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
          >
            <X size={10} />
          </button>
        </form>
      )}
    </div>
  );

  const totalPills = views.length + 1 + (customViews?.length ?? 0); // +1 for "Opis"

  return (
    <div className="lg-vs-frame" aria-label="Widoki tablicy">
      <button
        type="button"
        aria-label="Przewiń w lewo"
        onClick={() => scrollBy(-180)}
        disabled={!canScrollLeft}
        className="lg-vs-chevron"
      >
        <ChevronLeft size={15} strokeWidth={2.2} />
      </button>

      <div
        ref={trackRef}
        role="tablist"
        onKeyDown={onKeyDown}
        className="lg-vs-track"
      >
        {views.map((v) => {
          const isActive = !activeViewId && !overviewActive && v.name === active;
          const defaultId = defaultViewIds?.[v.name];
          const canDelete = !!canManage && !!defaultId && !isActive && totalPills > 1;
          return renderPill({
            key: `v:${v.name}`,
            href: v.path,
            icon: v.icon,
            label: v.label,
            isActive,
            canDelete,
            viewIdToDelete: defaultId,
          });
        })}

        {/* "Opis" — per-board overview, zawsze widoczna (poza ViewType enum) */}
        {renderPill({
          key: "overview",
          href: overviewPath,
          icon: <FileText size={15} />,
          label: "Opis",
          isActive: overviewActive,
        })}

        {customViews?.map((c) => {
          const isActive = activeViewId === c.id;
          return renderPill({
            key: `c:${c.id}`,
            href: c.path,
            icon: DEFAULT_ICONS[c.type],
            label: c.name,
            isActive,
            canDelete: !!canManage,
            viewIdToDelete: c.id,
            deleteLabel: `Usuń widok ${c.name}`,
          });
        })}
      </div>

      {addViewSlot ? <div className="lg-vs-add-slot">{addViewSlot}</div> : null}

      <button
        type="button"
        aria-label="Przewiń w prawo"
        onClick={() => scrollBy(180)}
        disabled={!canScrollRight}
        className="lg-vs-chevron"
      >
        <ChevronRight size={15} strokeWidth={2.2} />
      </button>
    </div>
  );
}
