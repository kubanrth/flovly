"use client";

import {
  startTransition,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import {
  Table2,
  KanbanSquare,
  GitBranch,
  BarChart3,
  Pencil,
  FileText,
  X,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { deleteBoardViewAction } from "@/app/(app)/w/[workspaceId]/b/[boardId]/actions";
import type { ViewName } from "@/lib/board-views";

// Pure helpers live in @/lib/board-views — re-exporting from "use client" breaks server callers.
export type { ViewName };

// useLayoutEffect warns on the server; fall back to useEffect during SSR.
const useIsoLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

// Remembers the last active tab across SPA navigations (this component remounts
// per board route) so the indicator can slide FROM the previous tab on arrival.
let lastActive: { boardId: string; key: string } | null = null;

interface IndicatorRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

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
  table: <Table2 size={14} />,
  kanban: <KanbanSquare size={14} />,
  roadmap: <GitBranch size={14} />,
  gantt: <BarChart3 size={14} />,
  whiteboard: <Pencil size={14} />,
};
const DEFAULT_LABELS: Record<ViewName, string> = {
  table: "Tabela",
  kanban: "Kanban",
  roadmap: "Roadmapa",
  gantt: "Gantt",
  whiteboard: "Whiteboard",
};

export function ViewSwitcher({
  workspaceId,
  boardId,
  active,
  activeViewId,
  size = "md",
  enabled,
  customViews,
  canManage,
  defaultViewIds,
}: {
  workspaceId: string;
  boardId: string;
  // Active default view (undefined when the user is on a custom view).
  active?: ViewName;
  // Active custom view id, used for highlight instead of `active`.
  activeViewId?: string;
  size?: "sm" | "md";
  enabled?: ViewName[];
  customViews?: CustomViewDescriptor[];
  canManage?: boolean;
  // Undefined entries = legacy board without BoardView row → hide X.
  defaultViewIds?: Partial<Record<ViewName, string>>;
}) {
  const allViews: ViewDescriptor[] = [
    {
      name: "table",
      label: "Tabela",
      icon: DEFAULT_ICONS.table,
      path: `/w/${workspaceId}/b/${boardId}/table`,
    },
    {
      name: "kanban",
      label: "Kanban",
      icon: DEFAULT_ICONS.kanban,
      path: `/w/${workspaceId}/b/${boardId}/kanban`,
    },
    {
      name: "roadmap",
      label: "Roadmapa",
      icon: DEFAULT_ICONS.roadmap,
      path: `/w/${workspaceId}/b/${boardId}/roadmap`,
    },
    {
      name: "gantt",
      label: "Gantt",
      icon: DEFAULT_ICONS.gantt,
      path: `/w/${workspaceId}/b/${boardId}/gantt`,
    },
    {
      name: "whiteboard",
      label: "Whiteboard",
      icon: DEFAULT_ICONS.whiteboard,
      path: `/w/${workspaceId}/b/${boardId}/whiteboard`,
    },
  ];

  const views = enabled
    ? allViews.filter((v) => enabled.includes(v.name))
    : allViews;

  // Liquid-glass tabs (.lg-seg / .lg-seg-btn in globals.css).
  const heightClass =
    size === "sm" ? "h-7 px-2.5 text-[0.76rem]" : "h-8 px-3 text-[0.82rem]";

  // 6th tab 'Opis' is a per-board overview page outside ViewType enum (no BoardView row needed).
  const pathname = usePathname();
  const overviewPath = `/w/${workspaceId}/b/${boardId}/overview`;
  const overviewActive = pathname === overviewPath || pathname?.startsWith(`${overviewPath}/`);

  // Single moving highlight. Each tab registers its <a>; we measure the active
  // one relative to the segment and CSS-transition the indicator between them.
  const activeKey = overviewActive
    ? "overview"
    : activeViewId
      ? `c:${activeViewId}`
      : active
        ? `v:${active}`
        : null;

  const segRef = useRef<HTMLDivElement>(null);
  const linkRefs = useRef<Map<string, HTMLElement>>(new Map());
  const [indicator, setIndicator] = useState<IndicatorRect | null>(null);

  const setLinkRef = useCallback(
    (key: string) => (el: HTMLElement | null) => {
      if (el) linkRefs.current.set(key, el);
      else linkRefs.current.delete(key);
    },
    [],
  );

  const measureRel = useCallback((el: HTMLElement): IndicatorRect | null => {
    const seg = segRef.current;
    if (!seg) return null;
    const s = seg.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return { left: r.left - s.left, top: r.top - s.top, width: r.width, height: r.height };
  }, []);

  useIsoLayoutEffect(() => {
    if (!activeKey) {
      setIndicator(null);
      return;
    }
    const activeEl = linkRefs.current.get(activeKey);
    if (!activeEl) {
      setIndicator(null);
      return;
    }
    const target = measureRel(activeEl);
    if (!target) return;
    const prevEl =
      lastActive && lastActive.boardId === boardId && lastActive.key !== activeKey
        ? linkRefs.current.get(lastActive.key)
        : null;
    const start = prevEl ? measureRel(prevEl) : null;
    if (start) {
      setIndicator(start);
      // Two frames so the start position paints before we transition to target.
      requestAnimationFrame(() =>
        requestAnimationFrame(() => setIndicator(target)),
      );
    } else {
      setIndicator(target);
    }
    lastActive = { boardId, key: activeKey };
  }, [activeKey, boardId, measureRel]);

  // Realign on resize / tab-set changes — snap, no slide.
  useEffect(() => {
    const seg = segRef.current;
    if (!seg) return;
    const realign = () => {
      const activeEl = activeKey ? linkRefs.current.get(activeKey) : null;
      if (!activeEl) return;
      const target = measureRel(activeEl);
      if (!target) return;
      setIndicator((prev) =>
        prev &&
        prev.left === target.left &&
        prev.top === target.top &&
        prev.width === target.width &&
        prev.height === target.height
          ? prev
          : target,
      );
    };
    const ro = new ResizeObserver(realign);
    ro.observe(seg);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey, customViews, views.length]);

  return (
    <div
      ref={segRef}
      role="tablist"
      aria-label="Widoki tablicy"
      className={`lg-seg flex-wrap${indicator ? " lg-seg--js" : ""}`}
    >
      {indicator && (
        <span
          aria-hidden
          className="lg-seg-indicator"
          style={{
            transform: `translate(${indicator.left}px, ${indicator.top}px)`,
            width: indicator.width,
            height: indicator.height,
          }}
        />
      )}
      {views.map((v) => {
        const isActive = !activeViewId && v.name === active;
        const defaultId = defaultViewIds?.[v.name];
        // Block deleting the active view — would 404. User must switch first.
        const totalPills = views.length + (customViews?.length ?? 0);
        const canDelete = canManage && !!defaultId && !isActive && totalPills > 1;
        return (
          <div key={v.name} className="group relative">
            <Link
              href={v.path}
              ref={setLinkRef(`v:${v.name}`)}
              role="tab"
              aria-selected={isActive}
              data-active={isActive ? "true" : "false"}
              className={`lg-seg-btn font-sans focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${heightClass} ${canDelete ? "pr-6" : ""}`}
            >
              {v.icon}
              <span>{v.label}</span>
            </Link>
            {canDelete && defaultId && (
              <form
                action={(fd) => startTransition(() => deleteBoardViewAction(fd))}
                className="m-0 absolute right-1 top-1/2 -translate-y-1/2"
              >
                <input type="hidden" name="viewId" value={defaultId} />
                <button
                  type="submit"
                  aria-label={`Usuń widok ${v.label}`}
                  title={`Usuń widok ${v.label} z tablicy`}
                  className="grid h-4 w-4 place-items-center rounded-sm text-current opacity-0 transition-opacity hover:bg-destructive/20 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100 group-data-[active=true]:text-primary-foreground"
                >
                  <X size={10} />
                </button>
              </form>
            )}
          </div>
        );
      })}

      {/* F12-K57: stała pill 'Opis' (per-board rich-text overview).
          Zawsze widoczna, nie wymaga BoardView row'a w DB. */}
      <div className="group relative">
        <Link
          href={overviewPath}
          ref={setLinkRef("overview")}
          role="tab"
          aria-selected={overviewActive}
          data-active={overviewActive ? "true" : "false"}
          className={`lg-seg-btn font-sans focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${heightClass}`}
        >
          <FileText size={14} />
          <span>Opis</span>
        </Link>
      </div>

      {(customViews?.length ?? 0) > 0 && (
        <span
          aria-hidden
          className="mx-1 h-4 w-px bg-border"
          role="separator"
        />
      )}

      {customViews?.map((c) => {
        const isActive = activeViewId === c.id;
        return (
          <div key={c.id} className="group relative">
            <Link
              href={c.path}
              ref={setLinkRef(`c:${c.id}`)}
              role="tab"
              aria-selected={isActive}
              data-active={isActive ? "true" : "false"}
              className={`lg-seg-btn font-sans focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${heightClass} ${canManage ? "pr-6" : ""}`}
            >
              {DEFAULT_ICONS[c.type]}
              <span className="max-w-[160px] truncate">{c.name}</span>
            </Link>
            {canManage && (
              <form
                action={(fd) => startTransition(() => deleteBoardViewAction(fd))}
                className="m-0 absolute right-1 top-1/2 -translate-y-1/2"
              >
                <input type="hidden" name="viewId" value={c.id} />
                <button
                  type="submit"
                  aria-label={`Usuń widok ${c.name}`}
                  className="grid h-4 w-4 place-items-center rounded-sm text-current opacity-0 transition-opacity hover:bg-destructive/20 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100 group-data-[active=true]:text-primary-foreground"
                >
                  <X size={10} />
                </button>
              </form>
            )}
          </div>
        );
      })}
    </div>
  );
}

