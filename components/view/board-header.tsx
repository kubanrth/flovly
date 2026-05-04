import type { ReactNode } from "react";
import {
  ViewSwitcher,
  type CustomViewDescriptor,
  type ViewName,
} from "@/components/view/view-switcher";

// Unified board header: title + optional description + ViewSwitcher + right-
// side actions slot. Typography and spacing are fixed so all 5 views look
// identical above the fold.
export function BoardHeader({
  workspaceId,
  boardId,
  board,
  active,
  activeViewId,
  enabledViews,
  customViews,
  canManageViews,
  createViewButton,
  actions,
  extra,
  defaultViewIds,
}: {
  workspaceId: string;
  boardId: string;
  board: { name: string; description?: string | null };
  active?: ViewName;
  activeViewId?: string;
  enabledViews?: ViewName[];
  customViews?: CustomViewDescriptor[];
  canManageViews?: boolean;
  createViewButton?: ReactNode;
  actions?: ReactNode;
  extra?: ReactNode;
  defaultViewIds?: Partial<Record<ViewName, string>>;
}) {
  return (
    // F11-5: extra (link folders) now spans full width — previously
    // shared row with title/viewswitcher → narrower than the table below.
    // F12-K47: mobile — h2 mniejsze + ViewSwitcher horizontal-scroll
    // (negative margin do brzegu ekranu) + actions w nowej linii.
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <h2 className="font-display text-[1.2rem] font-bold leading-[1.15] tracking-[-0.02em] md:text-[1.5rem]">
            {board.name}
          </h2>
          {board.description && (
            <p className="text-[0.85rem] leading-[1.5] text-muted-foreground max-md:line-clamp-2 md:text-[0.9rem] md:leading-[1.55]">
              {board.description}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <ViewSwitcher
              workspaceId={workspaceId}
              boardId={boardId}
              active={active}
              activeViewId={activeViewId}
              enabled={enabledViews}
              customViews={customViews}
              canManage={canManageViews}
              defaultViewIds={defaultViewIds}
            />
            {createViewButton}
          </div>
        </div>
        {actions && (
          <div className="flex items-center gap-2 max-md:w-full max-md:flex-wrap">
            {actions}
          </div>
        )}
      </div>
      {extra && <div className="w-full">{extra}</div>}
    </div>
  );
}
