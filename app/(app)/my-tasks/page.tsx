import type { Prisma } from "@/lib/generated/prisma/client";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { taskPl } from "@/lib/pluralize";
import { FiltersBar, type SortMode } from "@/components/my-tasks/filters-bar";
import { AppShell } from "@/components/layout/app-shell";
import {
  HotkeyTaskList,
  type TaskListRow,
  type TaskListSection,
} from "@/components/my-tasks/hotkey-task-list";

interface MyTasksSearchParams {
  search?: string;
  boardIds?: string;
  sort?: SortMode;
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
          // statusColumns needed so the inline StatusPicker in the row can change task status.
          board: {
            select: {
              id: true,
              name: true,
              statusColumns: {
                select: { id: true, name: true, colorHex: true },
                orderBy: { order: "asc" },
              },
            },
          },
          statusColumn: true,
          tags: { include: { tag: true } },
          // For "already-assigned" highlight in the assign-hotkey popup.
          assignees: { select: { userId: true } },
        },
      },
    },
  });
}

type Assignment = Awaited<ReturnType<typeof loadAssignments>>[number];

export default async function MyTasksPage({
  searchParams,
}: {
  searchParams: Promise<MyTasksSearchParams>;
}) {
  const session = await auth();
  const userId = session!.user.id;
  const params = await searchParams;

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
    // Dedupe boards for the filter pills; same alive-only filter as loadAssignments.
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

  const boardMap = new Map<string, { id: string; name: string; workspaceName: string }>();
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

  const active = assignments.filter((a) => a.task.workspace);

  // Bucket only on default sort with no filters; custom sort = flat list.
  const showBuckets = filters.sort === "updatedDesc" && filters.search === "" && filters.boardIds.length === 0;
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const todayEnd = todayStart + 24 * 60 * 60 * 1000;

  const buckets: Record<"overdue" | "today" | "upcoming" | "nodate", Assignment[]> = {
    overdue: [],
    today: [],
    upcoming: [],
    nodate: [],
  };
  for (const a of active) {
    const d = a.task.stopAt?.getTime();
    if (!d) buckets.nodate.push(a);
    else if (d < todayStart) buckets.overdue.push(a);
    else if (d < todayEnd) buckets.today.push(a);
    else buckets.upcoming.push(a);
  }

  const totalCount = active.length;

  const toRow = (a: Assignment): TaskListRow => ({
    id: a.task.id,
    title: a.task.title,
    workspaceId: a.task.workspace.id,
    // boardId + boardStatusColumns feed the inline StatusPicker; statusColumnId is selection.
    boardId: a.task.board.id,
    statusColumnId: a.task.statusColumn?.id ?? null,
    boardStatusColumns: a.task.board.statusColumns.map((s) => ({
      id: s.id,
      name: s.name,
      colorHex: s.colorHex,
    })),
    workspaceName: a.task.workspace.name,
    boardName: a.task.board.name,
    status: a.task.statusColumn
      ? { name: a.task.statusColumn.name, colorHex: a.task.statusColumn.colorHex }
      : null,
    tags: a.task.tags.map((t) => ({
      id: t.tag.id,
      name: t.tag.name,
      colorHex: t.tag.colorHex,
    })),
    stopAt: a.task.stopAt ? a.task.stopAt.toISOString() : null,
    assigneeIds: a.task.assignees.map((x) => x.userId),
  });

  const sections: TaskListSection[] = showBuckets
    ? [
        { key: "overdue", label: "Zaległe", accent: "destructive", rows: buckets.overdue.map(toRow) },
        { key: "today", label: "Na dziś", accent: "primary", rows: buckets.today.map(toRow) },
        { key: "upcoming", label: "Nadchodzące", accent: "muted", rows: buckets.upcoming.map(toRow) },
        { key: "nodate", label: "Bez terminu", accent: "muted", rows: buckets.nodate.map(toRow) },
      ]
    : [{ key: "flat", label: "Wszystkie", accent: "none", rows: active.map(toRow) }];

  return (
    <AppShell>
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <span className="eyebrow">Zadania dla Ciebie</span>
          <h1 className="font-display text-[2.2rem] font-bold leading-[1.1] tracking-[-0.03em]">
            Twoja lista. <span className="text-brand-gradient">{totalCount}</span>{" "}
            {taskPl(totalCount)}.
          </h1>
          <p className="max-w-[60ch] text-[0.95rem] leading-[1.55] text-muted-foreground">
            Wszystko, gdzie Ty jesteś assignee. Najedź na zadanie i wciśnij{" "}
            <kbd className="rounded-sm border border-border bg-muted px-1 text-[0.7rem]">M</kbd>{" "}
            aby przypisać osobę.
          </p>
        </div>

        <FiltersBar
          boards={boards}
          initialSearch={filters.search}
          initialBoardIds={filters.boardIds}
          initialSort={filters.sort}
        />

        <HotkeyTaskList
          members={allMembers}
          sections={sections}
          emptyState={
            <div className="rounded-xl border border-dashed border-border p-10 text-center">
              <p className="font-display text-[1.1rem] font-semibold">
                {filters.search || filters.boardIds.length > 0
                  ? "Nic nie pasuje do filtrów."
                  : "Nikt Cię nie przypisał."}
              </p>
              <p className="mt-2 text-[0.92rem] text-muted-foreground">
                {filters.search || filters.boardIds.length > 0
                  ? "Spróbuj wyczyścić filtry."
                  : "Jak ktoś przypisze Cię do zadania, pojawi się tutaj."}
              </p>
            </div>
          }
        />
      </div>
    </AppShell>
  );
}
