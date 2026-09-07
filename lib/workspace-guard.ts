import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { assertCan, type Action } from "@/lib/permissions";
import type { Role } from "@/lib/generated/prisma/enums";

export interface WorkspaceSession {
  userId: string;
  email: string;
  isSuperAdmin: boolean;
  workspaceId: string;
  role: Role;
}

// Require an authenticated session + workspace membership.
// Redirects to login if unauthenticated; calls notFound() if no membership
// (matches GitHub/Linear behavior — don't leak workspace existence).
// React.cache: w jednym requescie layouty, strona, panel zadania i akcje
// wolaja to kilkukrotnie dla tego samego workspaceId — auth + zapytanie
// o czlonkostwo ida raz. Wynik nadal jest liczony na serwerze per request.
export const requireWorkspaceMembership = cache(async function requireWorkspaceMembership(
  workspaceId: string,
): Promise<WorkspaceSession> {
  const session = await auth();
  if (!session?.user) redirect("/secure-access-portal");

  const membership = await db.workspaceMembership.findFirst({
    where: {
      workspaceId,
      userId: session.user.id,
      workspace: { deletedAt: null },
    },
  });

  if (!membership) notFound();

  return {
    userId: session.user.id,
    email: session.user.email ?? "",
    isSuperAdmin: session.user.isSuperAdmin,
    workspaceId,
    role: membership.role,
  };
});

export async function requireWorkspaceAction(
  workspaceId: string,
  action: Action,
): Promise<WorkspaceSession> {
  const ctx = await requireWorkspaceMembership(workspaceId);
  assertCan(ctx.role, action);
  return ctx;
}

// Per-board access check. Returns true if:
//   1. Workspace ADMIN — they bypass board ACL by design.
//   2. Board.visibility = PUBLIC — every workspace member sees it.
//   3. BoardMembership row exists for this user on this board.
//
// Requires the caller to have already validated workspace membership
// (this function does NOT redirect; it's a pure boolean check). Pair
// with `requireWorkspaceMembership` first.
export async function userCanAccessBoard(
  boardId: string,
  userId: string,
  workspaceRole: Role,
): Promise<boolean> {
  if (workspaceRole === "ADMIN") return true;
  // Jedno zapytanie zamiast dwoch sekwencyjnych (widocznosc + czlonkostwo).
  const board = await db.board.findUnique({
    where: { id: boardId },
    select: { visibility: true, memberships: { where: { userId }, select: { id: true } } },
  });
  if (!board) return false;
  return board.visibility === "PUBLIC" || board.memberships.length > 0;
}

// Like `requireWorkspaceMembership`, but additionally enforces board
// access. 404s when the user lacks access — never leaks whether the
// board exists. Returns the workspace session augmented with the
// board-level role (or workspace role for ADMINs / public boards).
export interface BoardSession extends WorkspaceSession {
  boardRole: Role; // effective role for this board (= workspace role if ADMIN/PUBLIC)
}

export async function requireBoardAccess(
  workspaceId: string,
  boardId: string,
): Promise<BoardSession> {
  const ctx = await requireWorkspaceMembership(workspaceId);
  // Workspace ADMIN bypasses board ACL.
  if (ctx.role === "ADMIN") return { ...ctx, boardRole: ctx.role };
  const board = await db.board.findFirst({
    where: { id: boardId, workspaceId, deletedAt: null },
    select: { visibility: true },
  });
  if (!board) notFound();
  if (board.visibility === "PUBLIC") return { ...ctx, boardRole: ctx.role };
  const membership = await db.boardMembership.findUnique({
    where: { boardId_userId: { boardId, userId: ctx.userId } },
    select: { role: true },
  });
  if (!membership) notFound();
  // Effective role: cap at workspace role so e.g. a board ADMIN who is
  // a workspace VIEWER doesn't gain elevated workspace privileges.
  // Strict: pick the more restrictive of the two.
  const ranked: Record<Role, number> = { ADMIN: 3, MEMBER: 2, VIEWER: 1 };
  const boardRole: Role =
    ranked[membership.role] < ranked[ctx.role] ? membership.role : ctx.role;
  return { ...ctx, boardRole };
}
