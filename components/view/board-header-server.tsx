import type { ReactNode } from "react";
import { db } from "@/lib/db";
import { requireWorkspaceMembership } from "@/lib/workspace-guard";
import { can } from "@/lib/permissions";
import { BoardHeader } from "@/components/view/board-header";
import type { CustomViewDescriptor } from "@/components/view/view-switcher";
import {
  computeBoardEnabledViews,
  viewTypeToName,
  type ViewName,
} from "@/lib/board-views";
import { CreateViewDialog } from "@/components/view/create-view-dialog";

// Server wrapper that hydrates BoardHeader with custom views from the DB
// and appends the `+ Widok` create button. Use this from every board page
// instead of BoardHeader directly — keeps the fetch close to the render.
export async function BoardHeaderServer({
  workspaceId,
  boardId,
  board,
  active,
  activeViewId,
  enabledViews,
  actions,
  extra,
}: {
  workspaceId: string;
  boardId: string;
  board: { name: string; description?: string | null };
  active?: ViewName;
  activeViewId?: string;
  enabledViews: ViewName[];
  actions?: ReactNode;
  extra?: ReactNode;
}) {
  const ctx = await requireWorkspaceMembership(workspaceId);
  const canManage = can(ctx.role, "board.update");

  // One query for both custom views (name != null) and default view-type
  // markers (name = null) — we narrow in JS to avoid two round-trips.
  const allViews = await db.boardView.findMany({
    where: { boardId },
    orderBy: { createdAt: "asc" },
  });
  const custom = allViews.filter((v) => v.name !== null);
  const defaults = allViews.filter((v) => v.name === null);
  const defaultTypes = defaults.map((v) => v.type);
  // Map default ViewName → BoardView id so the ViewSwitcher knows which
  // row to delete when the user clicks X on a default pill.
  const defaultViewIds: Partial<Record<ViewName, string>> = {};
  for (const d of defaults) {
    const name = viewTypeToName(d.type);
    if (name) defaultViewIds[name] = d.id;
  }

  const effectiveEnabled = computeBoardEnabledViews(enabledViews, defaultTypes);

  const customViews: CustomViewDescriptor[] = custom.map((v) => ({
    id: v.id,
    name: v.name ?? "Widok",
    type: viewTypeToName(v.type) ?? "table",
    path: `/w/${workspaceId}/b/${boardId}/v/${v.id}`,
  }));

  return (
    <BoardHeader
      workspaceId={workspaceId}
      boardId={boardId}
      board={board}
      active={active}
      activeViewId={activeViewId}
      enabledViews={effectiveEnabled}
      customViews={customViews}
      canManageViews={canManage}
      canEditName={canManage}
      defaultViewIds={defaultViewIds}
      createViewButton={
        canManage ? (
          <CreateViewDialog
            workspaceId={workspaceId}
            boardId={boardId}
            // Pass the FULL workspace-level enabled set so the user can
            // recreate a default they previously deleted. effectiveEnabled
            // (which we use for the pill list) is filtered down to types
            // that currently have a default — wrong source for the picker.
            enabled={enabledViews}
            existingDefaultTypes={
              Object.keys(defaultViewIds).filter(
                (k): k is ViewName => Boolean(defaultViewIds[k as ViewName]),
              )
            }
          />
        ) : null
      }
      actions={actions}
      extra={extra}
    />
  );
}
