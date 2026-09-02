"use server";

// B3: read-only loader for the Nowe zadanie / Import dialogs — statuses,
// members and named views of a board. No mutation, no schema change; lives
// here (not in app/**/actions.ts) because only these two dialogs use it.
import { db } from "@/lib/db";
import { requireWorkspaceMembership } from "@/lib/workspace-guard";

export interface BoardMeta {
  boardName: string;
  statuses: { id: string; name: string; colorHex: string | null }[];
  members: { id: string; name: string; avatarUrl: string | null }[];
  views: { id: string; name: string }[];
  // Do wyboru milestone'a przy tworzeniu zadania. Daty sa potrzebne, zeby
  // pokazac zakres i ostrzec, zanim serwer odrzuci przypisanie.
  milestones: { id: string; title: string; startAt: string; stopAt: string }[];
}

export async function getBoardMetaAction(workspaceId: string, boardId: string): Promise<BoardMeta | null> {
  await requireWorkspaceMembership(workspaceId);
  const [board, memberships] = await Promise.all([
    db.board.findFirst({
      where: { id: boardId, workspaceId, deletedAt: null },
      select: {
        name: true,
        statusColumns: { orderBy: { order: "asc" }, select: { id: true, name: true, colorHex: true } },
        views: { where: { name: { not: null } }, orderBy: { createdAt: "asc" }, select: { id: true, name: true } },
        milestones: { where: { deletedAt: null }, orderBy: { startAt: "asc" }, select: { id: true, title: true, startAt: true, stopAt: true } },
      },
    }),
    db.workspaceMembership.findMany({
      where: { workspaceId },
      orderBy: { joinedAt: "asc" },
      select: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    }),
  ]);
  if (!board) return null;
  return {
    boardName: board.name,
    statuses: board.statusColumns,
    members: memberships.map((m) => ({ id: m.user.id, name: m.user.name ?? m.user.email, avatarUrl: m.user.avatarUrl })),
    views: board.views.map((v) => ({ id: v.id, name: v.name ?? "" })),
    milestones: board.milestones.map((m) => ({
      id: m.id, title: m.title, startAt: m.startAt.toISOString(), stopAt: m.stopAt.toISOString(),
    })),
  };
}
