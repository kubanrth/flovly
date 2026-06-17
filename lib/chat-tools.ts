// F12-K74 Czesiek AI — tool definitions + executors.
//
// Tool calling pattern (OpenAI/Groq compatible):
//   1. /api/chat dostaje user message → wysyła do LLM razem z TOOL_DEFS.
//   2. LLM zwraca toolCalls albo zwykłą odpowiedź.
//   3. Dla każdego toolCall wołamy executeChatTool(name, args, context)
//      → wynik wraca jako "tool" message do LLM'a.
//   4. LLM widzi tool results i pisze finalną odpowiedź dla usera.
//
// Każde executor MUSI respektować workspace scope (workspaceId z contextu) +
// per-user board memberships (PRIVATE boards) — user nie zobaczy danych do
// których nie ma dostępu nawet jeśli przekona LLM'a żeby je zapytał.
//
// MVP scope: READ-only. Żaden tool nie modyfikuje danych w bazie.

import { db } from "@/lib/db";
import type { ChatTool } from "@/lib/llm";

export type ToolContext = {
  workspaceId: string;
  userId: string;
};

// JSON Schema dla parametrów tool'a. Trzymane w jednym miejscu żeby
// definicja i parsowanie były spójne (LLM widzi exactly to co my walidujemy).
export const TOOL_DEFS: ChatTool[] = [
  {
    name: "list_boards",
    description:
      "Zwraca listę wszystkich tablic w workspace do których użytkownik ma dostęp. " +
      "Każda tablica ma id, name, opis, ilość zadań aktywnych. " +
      "Użyj gdy user pyta 'jakie tablice mamy', 'pokaż wszystkie tablice', 'ile tablic'.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "list_tasks",
    description:
      "Zwraca listę zadań w workspace lub w konkretnej tablicy. Filtruje opcjonalnie " +
      "po assignee, status, deadlinach. Zwraca max 30 zadań posortowane po updatedAt DESC. " +
      "Użyj gdy user pyta 'pokaż zadania X', 'co robi Y', 'zadania w tablicy Z'.",
    parameters: {
      type: "object",
      properties: {
        boardId: {
          type: "string",
          description:
            "Opcjonalne — gdy podane, ograniczamy do tej tablicy. " +
            "Jeśli user wymienił nazwę tablicy, najpierw wywołaj list_boards żeby znaleźć id.",
        },
        assigneeUserId: {
          type: "string",
          description: "Opcjonalne — filter po przypisanym userze.",
        },
        statusName: {
          type: "string",
          description:
            "Opcjonalne — case-insensitive nazwa kolumny status (np. 'todo', 'in progress', 'done').",
        },
        limit: {
          type: "number",
          description: "Max ile zadań zwrócić (default 30, max 50).",
        },
      },
      required: [],
    },
  },
  {
    name: "list_overdue_tasks",
    description:
      "Zwraca zadania, których stopAt jest w przeszłości i które nie są zakończone " +
      "(nie mają timerCompletedAt). Posortowane po stopAt ASC (najstarsze przeterminowane na górze). " +
      "Użyj gdy user pyta 'co jest przeterminowane', 'co spóźnione', 'opóźnione'.",
    parameters: {
      type: "object",
      properties: {
        boardId: {
          type: "string",
          description: "Opcjonalne ograniczenie do jednej tablicy.",
        },
        limit: { type: "number" },
      },
      required: [],
    },
  },
  {
    name: "get_user_activity",
    description:
      "Zwraca aktywność danego użytkownika z ostatnich X dni — które zadania edytował, " +
      "tworzył, komentował, zmieniał status. Dane pochodzą z AuditLog. " +
      "Użyj gdy user pyta 'co X robił', 'aktywność Y', 'co się działo z X'.",
    parameters: {
      type: "object",
      properties: {
        userIdOrName: {
          type: "string",
          description:
            "ID użytkownika ALBO imię/email do wyszukania. Najpierw spróbuj jako ID, " +
            "jeśli nie znajdzie, robimy fuzzy search po name/email.",
        },
        days: {
          type: "number",
          description: "Ile dni wstecz (default 7, max 30).",
        },
        limit: { type: "number" },
      },
      required: ["userIdOrName"],
    },
  },
];

// ─────────── Executor ──────────────────────────────────────────────────────

export type ToolResult =
  | { ok: true; data: unknown }
  | { ok: false; error: string };

export async function executeChatTool(
  name: string,
  argsJson: string,
  ctx: ToolContext,
): Promise<ToolResult> {
  let args: Record<string, unknown> = {};
  try {
    args = argsJson ? (JSON.parse(argsJson) as Record<string, unknown>) : {};
  } catch (e) {
    return {
      ok: false,
      error: `Nie udało się sparsować argumentów: ${
        e instanceof Error ? e.message : "unknown"
      }`,
    };
  }

  try {
    switch (name) {
      case "list_boards":
        return { ok: true, data: await toolListBoards(ctx) };
      case "list_tasks":
        return { ok: true, data: await toolListTasks(ctx, args) };
      case "list_overdue_tasks":
        return { ok: true, data: await toolListOverdueTasks(ctx, args) };
      case "get_user_activity":
        return { ok: true, data: await toolGetUserActivity(ctx, args) };
      default:
        return { ok: false, error: `Nieznany tool: ${name}` };
    }
  } catch (e) {
    console.error(`[chat-tools] ${name} failed`, e);
    return {
      ok: false,
      error: `Błąd wykonania tool'a ${name}: ${
        e instanceof Error ? e.message : "unknown"
      }`,
    };
  }
}

// ─────────── Pomocnik: lista board ID'ów do których user ma dostęp ─────────
// Logika:
//   1. Pobieramy wszystkie boards w workspace (z deletedAt = null).
//   2. Dla boardów PRIVATE filtrujemy do tych gdzie user ma BoardMembership
//      ALBO jest workspace ADMIN'em.
// Wynik = string[] z board.id które LLM może bezpiecznie pytać.

async function getAccessibleBoardIds(ctx: ToolContext): Promise<string[]> {
  const membership = await db.workspaceMembership.findUnique({
    where: {
      workspaceId_userId: { workspaceId: ctx.workspaceId, userId: ctx.userId },
    },
    select: { role: true },
  });
  const isAdmin = membership?.role === "ADMIN";

  const boards = await db.board.findMany({
    where: { workspaceId: ctx.workspaceId, deletedAt: null },
    select: { id: true, visibility: true },
  });

  if (isAdmin) return boards.map((b) => b.id);

  const privateBoardIds = boards
    .filter((b) => b.visibility === "PRIVATE")
    .map((b) => b.id);

  if (privateBoardIds.length === 0) return boards.map((b) => b.id);

  const memberships = await db.boardMembership.findMany({
    where: { userId: ctx.userId, boardId: { in: privateBoardIds } },
    select: { boardId: true },
  });
  const memberOfPrivate = new Set(memberships.map((m) => m.boardId));

  return boards
    .filter((b) => b.visibility !== "PRIVATE" || memberOfPrivate.has(b.id))
    .map((b) => b.id);
}

// ─────────── Tool: list_boards ─────────────────────────────────────────────

async function toolListBoards(ctx: ToolContext) {
  const ids = await getAccessibleBoardIds(ctx);
  const boards = await db.board.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      name: true,
      description: true,
      updatedAt: true,
      _count: { select: { tasks: { where: { deletedAt: null } } } },
    },
    orderBy: { updatedAt: "desc" },
  });
  return {
    count: boards.length,
    boards: boards.map((b) => ({
      id: b.id,
      name: b.name,
      description: b.description,
      taskCount: b._count.tasks,
      updatedAt: b.updatedAt.toISOString(),
    })),
  };
}

// ─────────── Tool: list_tasks ──────────────────────────────────────────────

async function toolListTasks(ctx: ToolContext, args: Record<string, unknown>) {
  const boardId = typeof args.boardId === "string" ? args.boardId : undefined;
  const assigneeUserId =
    typeof args.assigneeUserId === "string" ? args.assigneeUserId : undefined;
  const statusName =
    typeof args.statusName === "string" ? args.statusName.toLowerCase() : undefined;
  const limit = Math.min(
    50,
    typeof args.limit === "number" && args.limit > 0 ? args.limit : 30,
  );

  const accessibleBoards = await getAccessibleBoardIds(ctx);
  if (accessibleBoards.length === 0) return { count: 0, tasks: [] };

  // Gdy LLM podał konkretny boardId — sprawdzamy że user ma do niego dostęp.
  if (boardId && !accessibleBoards.includes(boardId)) {
    return {
      count: 0,
      tasks: [],
      note: "Nie masz dostępu do tej tablicy.",
    };
  }

  const tasks = await db.task.findMany({
    where: {
      workspaceId: ctx.workspaceId,
      deletedAt: null,
      boardId: boardId ?? { in: accessibleBoards },
      ...(assigneeUserId
        ? { assignees: { some: { userId: assigneeUserId } } }
        : {}),
    },
    select: {
      id: true,
      displayId: true,
      title: true,
      startAt: true,
      stopAt: true,
      timerCompletedAt: true,
      updatedAt: true,
      board: { select: { id: true, name: true } },
      statusColumn: { select: { id: true, name: true, colorHex: true } },
      assignees: {
        select: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });

  const filtered = statusName
    ? tasks.filter((t) => t.statusColumn?.name.toLowerCase().includes(statusName))
    : tasks;

  return {
    count: filtered.length,
    tasks: filtered.map((t) => ({
      id: t.id,
      displayId: t.displayId,
      title: t.title,
      board: t.board.name,
      status: t.statusColumn?.name ?? null,
      assignees: t.assignees.map(
        (a) => a.user.name ?? a.user.email.split("@")[0],
      ),
      deadline: t.stopAt?.toISOString() ?? null,
      completed: t.timerCompletedAt !== null,
      updatedAt: t.updatedAt.toISOString(),
    })),
  };
}

// ─────────── Tool: list_overdue_tasks ──────────────────────────────────────

async function toolListOverdueTasks(
  ctx: ToolContext,
  args: Record<string, unknown>,
) {
  const boardId = typeof args.boardId === "string" ? args.boardId : undefined;
  const limit = Math.min(
    50,
    typeof args.limit === "number" && args.limit > 0 ? args.limit : 30,
  );

  const accessibleBoards = await getAccessibleBoardIds(ctx);
  if (accessibleBoards.length === 0) return { count: 0, tasks: [] };

  if (boardId && !accessibleBoards.includes(boardId)) {
    return { count: 0, tasks: [], note: "Nie masz dostępu do tej tablicy." };
  }

  const now = new Date();
  const tasks = await db.task.findMany({
    where: {
      workspaceId: ctx.workspaceId,
      deletedAt: null,
      boardId: boardId ?? { in: accessibleBoards },
      stopAt: { lt: now },
      timerCompletedAt: null,
    },
    select: {
      id: true,
      displayId: true,
      title: true,
      stopAt: true,
      board: { select: { name: true } },
      statusColumn: { select: { name: true } },
      assignees: {
        select: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
    },
    orderBy: { stopAt: "asc" },
    take: limit,
  });

  return {
    count: tasks.length,
    tasks: tasks.map((t) => ({
      id: t.id,
      displayId: t.displayId,
      title: t.title,
      board: t.board.name,
      status: t.statusColumn?.name ?? null,
      deadline: t.stopAt?.toISOString() ?? null,
      // Liczba dni opóźnienia — wygodniejsze niż liczenie po stronie LLM.
      daysOverdue: t.stopAt
        ? Math.floor((now.getTime() - t.stopAt.getTime()) / 86_400_000)
        : null,
      assignees: t.assignees.map(
        (a) => a.user.name ?? a.user.email.split("@")[0],
      ),
    })),
  };
}

// ─────────── Tool: get_user_activity ───────────────────────────────────────

async function toolGetUserActivity(
  ctx: ToolContext,
  args: Record<string, unknown>,
) {
  const needle =
    typeof args.userIdOrName === "string" ? args.userIdOrName.trim() : "";
  if (!needle) return { count: 0, events: [], error: "Brak userIdOrName." };

  const days = Math.min(
    30,
    typeof args.days === "number" && args.days > 0 ? args.days : 7,
  );
  const limit = Math.min(
    50,
    typeof args.limit === "number" && args.limit > 0 ? args.limit : 30,
  );

  // Najpierw szukamy po id, potem po name/email (case-insensitive contains).
  // Ograniczamy do member'ów tego workspace'u — Czesiek nie widzi cudzych
  // workspace'ów.
  const candidates = await db.user.findMany({
    where: {
      AND: [
        {
          memberships: {
            some: { workspaceId: ctx.workspaceId },
          },
        },
        {
          OR: [
            { id: needle },
            { name: { contains: needle, mode: "insensitive" } },
            { email: { contains: needle, mode: "insensitive" } },
          ],
        },
      ],
    },
    select: { id: true, name: true, email: true },
    take: 5,
  });

  if (candidates.length === 0) {
    return {
      count: 0,
      events: [],
      note: `Nie znalazłem użytkownika pasującego do "${needle}" w tym workspace.`,
    };
  }
  if (candidates.length > 1) {
    return {
      count: 0,
      events: [],
      candidates: candidates.map((u) => ({
        id: u.id,
        name: u.name ?? u.email.split("@")[0],
        email: u.email,
      })),
      note: "Znalazłem kilku użytkowników — zapytaj o doprecyzowanie.",
    };
  }

  const target = candidates[0];
  const since = new Date(Date.now() - days * 86_400_000);

  const events = await db.auditLog.findMany({
    where: {
      workspaceId: ctx.workspaceId,
      actorId: target.id,
      createdAt: { gte: since },
    },
    select: {
      id: true,
      objectType: true,
      objectId: true,
      action: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  // Doklejamy human-readable label dla Task / Board żeby LLM widział tytuły.
  const taskIds = events
    .filter((e) => e.objectType === "Task")
    .map((e) => e.objectId);
  const boardIds = events
    .filter((e) => e.objectType === "Board")
    .map((e) => e.objectId);

  const [tasks, boards] = await Promise.all([
    taskIds.length > 0
      ? db.task.findMany({
          where: { id: { in: taskIds } },
          select: { id: true, title: true, displayId: true },
        })
      : Promise.resolve([]),
    boardIds.length > 0
      ? db.board.findMany({
          where: { id: { in: boardIds } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
  ]);
  const taskById = new Map(tasks.map((t) => [t.id, t]));
  const boardById = new Map(boards.map((b) => [b.id, b]));

  return {
    user: {
      id: target.id,
      name: target.name ?? target.email.split("@")[0],
      email: target.email,
    },
    sinceDays: days,
    count: events.length,
    events: events.map((e) => ({
      action: e.action,
      objectType: e.objectType,
      label:
        e.objectType === "Task"
          ? taskById.get(e.objectId)?.title ?? "(usunięte zadanie)"
          : e.objectType === "Board"
            ? boardById.get(e.objectId)?.name ?? "(usunięta tablica)"
            : e.objectId,
      at: e.createdAt.toISOString(),
    })),
  };
}
