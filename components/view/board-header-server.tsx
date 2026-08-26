import type { ReactNode } from "react";
import { db } from "@/lib/db";
import { requireWorkspaceMembership } from "@/lib/workspace-guard";
import { can } from "@/lib/permissions";
import { BoardHeader, type BoardMember } from "@/components/view/board-header";
import type { CustomViewDescriptor } from "@/components/view/view-switcher";
import {
  computeBoardEnabledViews,
  viewTypeToName,
  type ViewName,
} from "@/lib/board-views";
import { CreateViewDialog } from "@/components/view/create-view-dialog";

// Server wrapper that hydrates BoardHeader with custom views, members and
// the `+` create-view slot. Use this from every board page instead of
// BoardHeader directly — keeps the fetch close to the render.
export async function BoardHeaderServer({
  workspaceId,
  boardId,
  board,
  active,
  activeViewId,
  enabledViews,
  actions,
  extra,
  toolbar,
}: {
  workspaceId: string;
  boardId: string;
  board: { name: string; description?: string | null };
  active?: ViewName;
  activeViewId?: string;
  enabledViews: ViewName[];
  actions?: ReactNode;
  extra?: ReactNode;
  toolbar?: ReactNode;
}) {
  const ctx = await requireWorkspaceMembership(workspaceId);
  const canManage = can(ctx.role, "board.update");

  const [allViews, memberships, workspace] = await Promise.all([
    // One query for both custom views (name != null) and default view-type
    // markers (name = null) — narrowed in JS to avoid two round-trips.
    db.boardView.findMany({ where: { boardId }, orderBy: { createdAt: "asc" } }),
    // ponytail: avatar stack = workspace members (BoardMembership only exists for PRIVATE boards).
    db.workspaceMembership.findMany({
      where: { workspaceId },
      select: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
      orderBy: { joinedAt: "asc" },
    }),
    db.workspace.findUnique({ where: { id: workspaceId }, select: { name: true } }),
  ]);
  const custom = allViews.filter((v) => v.name !== null);
  const defaults = allViews.filter((v) => v.name === null);
  const defaultTypes = defaults.map((v) => v.type);
  // Map default ViewName → BoardView id so the ViewSwitcher knows which
  // row to delete when the user removes a default tab.
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

  const members: BoardMember[] = memberships.map((m) => ({
    id: m.user.id,
    name: m.user.name ?? m.user.email,
    avatarUrl: m.user.avatarUrl,
  }));

  return (
    <BoardHeader
      workspaceId={workspaceId}
      workspaceName={workspace?.name}
      boardId={boardId}
      board={board}
      active={active}
      activeViewId={activeViewId}
      enabledViews={effectiveEnabled}
      customViews={customViews}
      canManageViews={canManage}
      canEditName={canManage}
      defaultViewIds={defaultViewIds}
      members={members}
      toolbar={toolbar}
      createViewButton={
        canManage ? (
          <CreateViewDialog
            workspaceId={workspaceId}
            boardId={boardId}
            // Full workspace-level set so a previously deleted default can be
            // recreated; effectiveEnabled is filtered to existing defaults.
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
