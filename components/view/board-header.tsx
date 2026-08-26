import type { ReactNode } from "react";
import { ViewSwitcher, type CustomViewDescriptor, type ViewName } from "@/components/view/view-switcher";
import { BoardHeaderMenu } from "@/components/view/board-header-menu";
import { EditableBoardName } from "@/components/board/editable-board-name";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { AvatarStack } from "@/components/ui/avatar";
import { IconChevronRight } from "@/components/ui/icons";

export interface BoardMember {
  id: string;
  name: string;
  avatarUrl?: string | null;
}

// Redesign v5 (A2): breadcrumb row (24px) + actions → title 20/600 + avatar
// stack → underline tabs → optional toolbar. Same above every board view.
export function BoardHeader({
  workspaceId,
  workspaceName,
  boardId,
  board,
  active,
  activeViewId,
  enabledViews,
  customViews,
  canManageViews,
  canEditName,
  createViewButton,
  actions,
  extra,
  defaultViewIds,
  members,
  toolbar,
}: {
  workspaceId: string;
  workspaceName?: string;
  boardId: string;
  board: { name: string; description?: string | null };
  active?: ViewName;
  activeViewId?: string;
  enabledViews?: ViewName[];
  customViews?: CustomViewDescriptor[];
  canManageViews?: boolean;
  // Default false — BoardHeaderServer sets true when `can(role, "board.update")`.
  canEditName?: boolean;
  createViewButton?: ReactNode;
  actions?: ReactNode;
  extra?: ReactNode;
  defaultViewIds?: Partial<Record<ViewName, string>>;
  members?: BoardMember[];
  toolbar?: ReactNode;
}) {
  return (
    <div data-ui="board-header" className="flex flex-col bg-card">
      <div className="px-6 pt-3 max-md:px-4">
        <div className="flex h-6 items-center gap-2 max-md:h-auto max-md:flex-wrap max-md:gap-y-2">
          <Breadcrumb
            items={[{ label: workspaceName ?? "Przestrzeń", href: `/w/${workspaceId}` }, { label: board.name }]}
            className="min-w-0"
          />
          <span className="flex-1" />
          {actions}
          <BoardHeaderMenu boardId={boardId} canEditName={!!canEditName} />
        </div>
        <div className="mt-1 flex items-center gap-2.5">
          {/* [&>button]:mx-0 — EditableTitle's -mx-1 + max-w-full is a cyclic % that clips 8px; -ml-1 keeps the optical align. */}
          <h2 data-ui="board-name" className="-ml-1 min-w-0 text-lg font-semibold tracking-[-0.2px] [&>button]:mx-0">
            <EditableBoardName workspaceId={workspaceId} boardId={boardId} name={board.name} canEdit={!!canEditName} />
          </h2>
          {members && members.length > 0 && (
            <AvatarStack people={members.map((m) => ({ name: m.name, src: m.avatarUrl }))} max={4} size={24} className="ml-1" />
          )}
        </div>
      </div>
      <div className="mt-0.5">
        <ViewSwitcher
          workspaceId={workspaceId}
          boardId={boardId}
          active={active}
          activeViewId={activeViewId}
          enabled={enabledViews}
          customViews={customViews}
          canManage={canManageViews}
          defaultViewIds={defaultViewIds}
          addViewSlot={createViewButton}
        />
      </div>
      {toolbar}
      {/* Link folders. The v5 mockups have no such strip and it ate ~150px of
          every board view, so it is collapsed by default — <details> keeps that
          a platform behaviour instead of another piece of state. */}
      {extra && (
        <details data-ui="board-links" className="group border-b border-border">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 px-6 py-1.5 text-xs text-fg-2 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-orange-500 max-md:px-4 [&::-webkit-details-marker]:hidden">
            <IconChevronRight className="size-3 transition-transform duration-150 group-open:rotate-90" />
            Linki tablicy
          </summary>
          <div className="px-6 pb-2 max-md:px-4">{extra}</div>
        </details>
      )}
    </div>
  );
}
