import type { ReactNode } from "react";
import {
  ViewSwitcher,
  type CustomViewDescriptor,
  type ViewName,
} from "@/components/view/view-switcher";
import { EditableBoardName } from "@/components/board/editable-board-name";

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
  canEditName,
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
  // Kontroluje czy h2 to inline-editable button czy plain text.
  // Domyślnie false — bezpieczny default, parent server component
  // (BoardHeaderServer) ustawia true gdy `can(role, "board.update")`.
  canEditName?: boolean;
  createViewButton?: ReactNode;
  actions?: ReactNode;
  extra?: ReactNode;
  defaultViewIds?: Partial<Record<ViewName, string>>;
}) {
  return (
    <div className="flex flex-col gap-3">
      {/* Top row: actions only, justify-end (Share / Import / Create Task
          do prawej). Wcześniej actions siedziały obok tytułu i przy szerokim
          ViewSwitcher'ze wypychały się poza viewport. */}
      {actions && (
        <div className="flex items-center justify-end gap-2 max-md:flex-wrap">
          {actions}
        </div>
      )}
      {/* Title + description */}
      <div className="flex min-w-0 flex-col gap-2">
        <h2 className="font-display text-[1.2rem] font-bold leading-[1.15] tracking-[-0.02em] md:text-[1.5rem]">
          <EditableBoardName
            workspaceId={workspaceId}
            boardId={boardId}
            name={board.name}
            canEdit={!!canEditName}
          />
        </h2>
        {board.description && (
          <p className="text-[0.85rem] leading-[1.5] text-muted-foreground max-md:line-clamp-2 md:text-[0.9rem] md:leading-[1.55]">
            {board.description}
          </p>
        )}
      </div>
      {/* ViewSwitcher full-width below the title */}
      <div className="flex w-full">
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
      {extra && <div className="w-full">{extra}</div>}
    </div>
  );
}
