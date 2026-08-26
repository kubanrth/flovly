import type { Prisma } from "@/lib/generated/prisma/client";
import { doneColumnIds, makeIsDone } from "@/components/board/done-status";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { TaskPriorityValue } from "@/lib/task-priority";
import type { MyTaskRow, SortMode } from "@/components/my-tasks/grouping";
import { MyTasksView, type BoardOption } from "@/components/my-tasks/my-tasks-view";

interface MyTasksSearchParams {
  search?: string;
  boardIds?: string;
  sort?: SortMode;
  // `?user=<id>` przełącza widok na zadania konkretnej osoby z zespołu —
  // używane przez przycisk "Sprawdź" w /profile team table. Musi być w
  // tym samym workspace co aktualny user, inaczej padamy do siebie.
  user?: string;
}

async function loadAssignments(
  userId: string,
  filters: {
    search: string;
    boardIds: string[];
    sort: SortMode;
  },
) {
  // Filter on workspace.deletedAt + board.deletedAt — soft-delete does not
  // cascade to tasks, so stale assignments would 404 when clicked.
  const where: Prisma.TaskAssigneeWhereInput = {
    userId,
    task: {
      deletedAt: null,
      workspace: { deletedAt: null },
      board: { deletedAt: null },
      ...(filters.search
        ? { title: { contains: filters.search, mode: "insensitive" as const } }
        : {}),
      ...(filters.boardIds.length > 0
        ? { boardId: { in: filters.boardIds } }
        : {}),
    },
  };

  const orderBy: Prisma.TaskAssigneeOrderByWithRelationInput = (() => {
    switch (filters.sort) {
      case "updatedAsc":
        return { task: { updatedAt: "asc" } };
      case "dueAsc":
        return { task: { stopAt: { sort: "asc", nulls: "last" } } };
      case "dueDesc":
        return { task: { stopAt: { sort: "desc", nulls: "last" } } };
      case "createdAsc":
        return { task: { createdAt: "asc" } };
      case "createdDesc":
        return { task: { createdAt: "desc" } };
      case "updatedDesc":
      default:
        return { task: { updatedAt: "desc" } };
    }
  })();

  return db.taskAssignee.findMany({
    where,
    orderBy,
    include: {
      task: {
        include: {
          workspace: { select: { id: true, name: true, slug: true } },
          // statusColumns: „ukończone” wg wspólnej reguły (done-status.ts) —
          // stąd też kolumna, w którą ☐ przenosi zadanie.
          board: {
            select: {
              id: true,
              name: true,
              statusColumns: {
                select: { id: true, name: true, colorHex: true, order: true },
                orderBy: { order: "asc" },
              },
            },
          },
          statusColumn: { select: { id: true, name: true, colorHex: true, order: true } },
          // For "already-assigned" highlight in the assign-hotkey popup.
          assignees: { select: { userId: true } },
        },
      },
    },
  });
}

export default async function MyTasksPage({
  searchParams,
}: {
  searchParams: Promise<MyTasksSearchParams>;
}) {
  const session = await auth();
  const currentUserId = session!.user.id;
  const params = await searchParams;

  // Resolve which user's task list to show. Default = self. `?user=<id>` is
  // honored only when that person shares at least one active workspace with
  // the viewer (auth boundary; otherwise the link silently falls back to
  // self so a manual URL tweak can't enumerate teammates).
  let viewedUser: { id: string; name: string | null; email: string } | null = null;
  if (params.user && params.user !== currentUserId) {
    viewedUser = await db.user.findFirst({
      where: {
        id: params.user,
        isBanned: false,
        deletedAt: null,
        memberships: {
          some: {
            workspace: {
              deletedAt: null,
              memberships: { some: { userId: currentUserId } },
            },
          },
        },
      },
      select: { id: true, name: true, email: true },
    });
  }
  const userId = viewedUser?.id ?? currentUserId;

  const filters = {
    search: (params.search ?? "").trim(),
    boardIds: (params.boardIds ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    sort: (params.sort ?? "updatedDesc") as SortMode,
  };

  const [assignments, boardOptions, userWorkspaces] = await Promise.all([
    loadAssignments(userId, filters),
    // Dedupe boards for the filter list; same alive-only filter as loadAssignments.
    db.taskAssignee.findMany({
      where: {
        userId,
        task: {
          deletedAt: null,
          workspace: { deletedAt: null },
          board: { deletedAt: null },
        },
      },
      select: {
        task: {
          select: {
            boardId: true,
            board: { select: { id: true, name: true } },
            workspace: { select: { name: true } },
          },
        },
      },
    }),
    // Union of members across the user's workspaces powers the assign-hotkey popup.
    // toggleAssigneeAction validates membership server-side.
    db.workspaceMembership.findMany({
      where: {
        workspace: {
          deletedAt: null,
          memberships: { some: { userId } },
        },
      },
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
    }),
  ]);

  // Dedupe by user id — a person in multiple workspaces would otherwise appear twice.
  const memberMap = new Map<string, { id: string; name: string | null; email: string; avatarUrl: string | null }>();
  for (const m of userWorkspaces) {
    if (!memberMap.has(m.user.id)) memberMap.set(m.user.id, m.user);
  }
  const allMembers = Array.from(memberMap.values()).sort((a, b) =>
    (a.name ?? a.email).localeCompare(b.name ?? b.email),
  );

  const boardMap = new Map<string, BoardOption>();
  for (const a of boardOptions) {
    if (!boardMap.has(a.task.boardId)) {
      boardMap.set(a.task.boardId, {
        id: a.task.boardId,
        name: a.task.board.name,
        workspaceName: a.task.workspace.name,
      });
    }
  }
  const boards = Array.from(boardMap.values()).sort((a, b) =>
    a.workspaceName.localeCompare(b.workspaceName) || a.name.localeCompare(b.name),
  );

  // „Ukończone” = wspólna reguła z components/board/done-status.ts (nazwa kolumny,
  // a dopiero potem ostatnia kolumna) — bez niej zamknięte zadania lądowały
  // w „Po terminie”. Ta sama funkcja daje kolumnę docelową dla ☐ w wierszu.
  const rows: MyTaskRow[] = assignments
    .filter((a) => a.task.workspace && !makeIsDone(a.task.board.statusColumns)(a.task.statusColumn?.id ?? null))
    .map((a) => {
      const done = [...doneColumnIds(a.task.board.statusColumns)];
      return {
        id: a.task.id,
        displayId: a.task.displayId,
        title: a.task.title,
        workspaceId: a.task.workspace.id,
        boardId: a.task.board.id,
        boardName: a.task.board.name,
        statusName: a.task.statusColumn?.name ?? null,
        statusColorHex: a.task.statusColumn?.colorHex ?? null,
        priority: a.task.priority as TaskPriorityValue,
        stopAt: a.task.stopAt ? a.task.stopAt.toISOString() : null,
        doneColumnId: done[0] ?? null,
        assigneeIds: a.task.assignees.map((x) => x.userId),
      };
    });

  return (
    <MyTasksView
      rows={rows}
      boards={boards}
      members={allMembers}
      nowIso={new Date().toISOString()}
      filters={filters}
      viewedUserName={viewedUser ? (viewedUser.name ?? viewedUser.email) : null}
    />
  );
}
