import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { TodoWorkspace } from "@/components/my/todo/todo-workspace";

// Microsoft-To-Do-like sidebar has three "smart" views that don't map to
// stored TodoList rows — they're dynamic filters on the user's entire
// item collection:
//   my-day    — items where myDayAt >= start-of-today (auto-expires)
//   important — items where important=true
//   planned   — items where dueDate is set
// F12-K22: 'assigned' smart view = workspace tasks gdzie current user
// jest przypisany (zastąpienie wcześniejszego embedded panelu w prawym).
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
  // Precedence: explicit listId > smart view > fall back to Mój dzień
  // (MS To Do always shows "My Day" as the default landing view).
  const activeListId = params.listId ?? null;
  const effectiveSmart: SmartView | null = !activeListId
    ? (smart ?? "my-day")
    : null;

  // Aggregate items — either from a single list or by smart-filter.
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const items = await (async () => {
    if (activeListId) {
      // Regular list view — scope by list + owner.
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

    // Smart view — pull across all lists, apply filter.
    // F12-K22: 'assigned' smart view nie ładuje TodoItems (pokazuje tylko
    // workspace TaskAssignee'y poniżej), więc skip tego query całkowicie.
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

  // Resolve active list name when viewing a single list.
  const activeList = activeListId
    ? lists.find((l) => l.id === activeListId) ?? null
    : null;

  // F12-K22: pull workspace tasks gdzie current user jest assignee.
  // Pokazywane jako osobny smart view 'Przydzielone do mnie' w sidebar'ze
  // (MS-To-Do parity). Też potrzebne gdy activeListId set, bo
  // prawy detail panel oryginalnie próbował to pokazywać — teraz tylko
  // dla smart='assigned'.
  const assignedTasks =
    activeListId || effectiveSmart === "assigned"
      ? await db.taskAssignee.findMany({
          where: {
            userId,
            // F12-K42: filtruj też po workspace.deletedAt + board.deletedAt
            // (analogicznie do /my-tasks i /my/calendar). Soft-delete nie
            // cascade'uje na taski, bez tego stare assignment'y leaknęłyby
            // i klik dawałby 404.
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

  // Also surface the "star" item by id if itemId is in URL — the client
  // can open the detail panel immediately without an extra fetch.
  const focusedItemId = params.itemId ?? null;

  // F12-K46: mobile UX (iOS-Reminders/MS-To-Do parity) — bez żadnego URL
  // param na mobile pokazujemy sidebar (foldery + listy + smart). Z param
  // (smart= albo listId=) → items view. Selected item (state) → detail.
  // Desktop nie używa tej flagi.
  const hasViewParam = !!params.smart || !!params.listId;

  // F9-11: Fullwidth layout — no AppShell wrapper, no max-width cap.
  // Klient chciał "całą szerokość ekranu jak MS To Do". Title collapses
  // into the sidebar header; main area uses all horizontal space.
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
