import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { TodoWorkspace } from "@/components/my/todo/todo-workspace";

// Smart views are dynamic filters on the user's full item collection,
// not stored TodoList rows:
//   my-day    — items where myDayAt >= start-of-today (auto-expires)
//   important — items where important=true
//   planned   — items where dueDate is set
//   assigned  — workspace tasks where the current user is assignee
export type SmartView = "my-day" | "important" | "planned" | "assigned";

function isSmartView(v: string | undefined): v is SmartView {
  return (
    v === "my-day" ||
    v === "important" ||
    v === "planned" ||
    v === "assigned"
  );
}

export default async function MyTodoPage({
  searchParams,
}: {
  searchParams: Promise<{ listId?: string; smart?: string; itemId?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/secure-access-portal");
  const userId = session.user.id;
  const params = await searchParams;

  const [folders, lists] = await Promise.all([
    db.todoFolder.findMany({
      where: { userId },
      orderBy: [{ parentId: "asc" }, { order: "asc" }],
    }),
    db.todoList.findMany({
      where: { userId },
      orderBy: [{ folderId: "asc" }, { order: "asc" }],
    }),
  ]);

  const smart = isSmartView(params.smart) ? params.smart : null;
  // Precedence: explicit listId > smart view > "My Day" fallback (MS To Do parity).
  const activeListId = params.listId ?? null;
  const effectiveSmart: SmartView | null = !activeListId
    ? (smart ?? "my-day")
    : null;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const items = await (async () => {
    if (activeListId) {
      const list = await db.todoList.findFirst({
        where: { id: activeListId, userId },
        select: { id: true },
      });
      if (!list) return [];
      return db.todoItem.findMany({
        where: { listId: activeListId, userId },
        orderBy: [{ completed: "asc" }, { important: "desc" }, { order: "asc" }],
        include: {
          steps: { orderBy: { order: "asc" } },
          list: { select: { id: true, name: true } },
        },
      });
    }

    // 'assigned' smart view only renders workspace TaskAssignees below — skip todo query.
    if (effectiveSmart === "assigned") return [];

    const smartWhere = (() => {
      switch (effectiveSmart) {
        case "my-day":
          return { userId, myDayAt: { gte: todayStart } };
        case "important":
          return { userId, important: true };
        case "planned":
          return { userId, dueDate: { not: null } };
        default:
          return { userId };
      }
    })();
    return db.todoItem.findMany({
      where: smartWhere,
      orderBy: [{ completed: "asc" }, { dueDate: "asc" }, { important: "desc" }, { order: "asc" }],
      include: {
        steps: { orderBy: { order: "asc" } },
        list: { select: { id: true, name: true } },
      },
    });
  })();

  const activeList = activeListId
    ? lists.find((l) => l.id === activeListId) ?? null
    : null;

  // Workspace tasks assigned to current user — surfaced as the 'Przydzielone do mnie'
  // smart view in the sidebar.
  const assignedTasks =
    activeListId || effectiveSmart === "assigned"
      ? await db.taskAssignee.findMany({
          where: {
            userId,
            // Filter on workspace.deletedAt + board.deletedAt — soft-delete does
            // not cascade to tasks, so without this, stale assignments leak and
            // clicking them 404s.
            task: {
              deletedAt: null,
              workspace: { deletedAt: null },
              board: { deletedAt: null },
            },
          },
          orderBy: { task: { updatedAt: "desc" } },
          take: 60,
          include: {
            task: {
              include: {
                workspace: { select: { id: true, name: true } },
                board: { select: { id: true, name: true } },
                statusColumn: { select: { name: true, colorHex: true } },
              },
            },
          },
        })
      : [];

  // itemId in URL opens the detail panel immediately without a client refetch.
  const focusedItemId = params.itemId ?? null;

  // Mobile drill-down: no view param → sidebar; with param → items view; selection → detail.
  // Desktop ignores this.
  const hasViewParam = !!params.smart || !!params.listId;

  return (
    <main className="flex-1 min-h-0">
      <TodoWorkspace
        folders={folders.map((f) => ({
          id: f.id,
          name: f.name,
          parentId: f.parentId,
        }))}
        lists={lists.map((l) => ({
          id: l.id,
          name: l.name,
          folderId: l.folderId,
        }))}
        activeListId={activeList?.id ?? null}
        activeListName={activeList?.name ?? null}
        smart={effectiveSmart}
        items={items.map((i) => ({
          id: i.id,
          content: i.content,
          completed: i.completed,
          important: i.important,
          myDayAt: i.myDayAt ? i.myDayAt.toISOString() : null,
          dueDate: i.dueDate ? i.dueDate.toISOString() : null,
          reminderAt: i.reminderAt ? i.reminderAt.toISOString() : null,
          notes: i.notes,
          listId: i.listId,
          listName: i.list.name,
          steps: i.steps.map((s) => ({
            id: s.id,
            title: s.title,
            completed: s.completed,
            notes: s.notes,
          })),
        }))}
        focusedItemId={focusedItemId}
        hasViewParam={hasViewParam}
        assignedTasks={assignedTasks.map((a) => ({
          id: a.task.id,
          title: a.task.title,
          workspaceId: a.task.workspaceId,
          workspaceName: a.task.workspace.name,
          boardId: a.task.boardId,
          boardName: a.task.board.name,
          statusName: a.task.statusColumn?.name ?? null,
          statusColor: a.task.statusColumn?.colorHex ?? null,
          stopAt: a.task.stopAt ? a.task.stopAt.toISOString() : null,
        }))}
      />
    </main>
  );
}
