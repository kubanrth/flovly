// F12-K74 Ateron AI — tool definitions + executors.
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
//
// v3 (po pierwszych testach z klientem): tool params akceptują NAZWY (imię,
// nazwa tablicy) zamiast tylko cuid'ków. LLM nie musi wcześniej wołać
// list_boards żeby znaleźć id — robimy fuzzy lookup wewnątrz każdego toola.

import { db } from "@/lib/db";
import type { ChatTool } from "@/lib/llm";

export type ToolContext = {
  workspaceId: string;
  userId: string;
};

export const TOOL_DEFS: ChatTool[] = [
  {
    name: "list_boards",
    description:
      "Zwraca listę wszystkich tablic (projektów) w workspace do których użytkownik ma dostęp. " +
      "Każda tablica ma id, name, opis, ilość zadań aktywnych. " +
      "Użyj gdy user pyta 'jakie tablice mamy', 'pokaż wszystkie tablice', 'ile tablic', 'jakie mam projekty'.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "find_user",
    description:
      "Wyszukuje użytkownika w workspace po imieniu, nazwisku lub fragmencie emaila. " +
      "Zwraca dopasowanych userów z ich id. Przykład: find_user('Kuba') → znajdzie 'Kuba Wernicki'. " +
      "UŻYJ ZAWSZE gdy user wymienia kogoś po imieniu w pytaniu, ZANIM wywołasz inne tools — " +
      "po id użytkownika możesz potem precyzyjnie filtrować zadania, aktywność itd.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Imię / nazwisko / fragment maila do dopasowania.",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "list_tasks",
    description:
      "Zwraca zadania w workspace. Możesz filtrować po nazwie tablicy, imieniu osoby przypisanej, " +
      "statusie lub stanie ukończenia. Domyślnie EXCLUDE ukończonych (z timerCompletedAt). " +
      "Zwraca max 30 zadań. " +
      "Użyj gdy user pyta 'pokaż zadania X', 'co robi Y', 'zadania w tablicy Z', 'co ma do zrobienia X', 'co mam do zrobienia'.",
    parameters: {
      type: "object",
      properties: {
        board: {
          type: "string",
          description:
            "Opcjonalne — nazwa tablicy ALBO board id. Robimy fuzzy match (np. 'P&R' " +
            "znajdzie 'P&R Flovly'). Gdy puste = wszystkie tablice user'a.",
        },
        assignee: {
          type: "string",
          description:
            "Opcjonalne — imię/nazwisko/email osoby przypisanej ALBO user id. Robimy fuzzy " +
            "match. Jeśli user pyta 'co mam do zrobienia' / 'moje zadania' — przekaż " +
            "tu specjalną wartość 'ME' (Ateron użyje zalogowanego usera).",
        },
        status: {
          type: "string",
          description:
            "Opcjonalne — nazwa kolumny status (np. 'todo', 'in progress'). Fuzzy contains.",
        },
        includeCompleted: {
          type: "boolean",
          description:
            "Default false (NIE pokazujemy ukończonych). Ustaw true gdy user pyta wprost o " +
            "ukończone albo 'wszystkie zadania, łącznie z zamkniętymi'.",
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
      "Zwraca zadania których stopAt jest w przeszłości i które nie są zakończone " +
      "(brak timerCompletedAt). Posortowane po stopAt ASC (najstarsze przeterminowane na górze). " +
      "Użyj gdy user pyta 'co przeterminowane', 'co spóźnione', 'opóźnione', 'co po deadlinie'.",
    parameters: {
      type: "object",
      properties: {
        board: {
          type: "string",
          description: "Opcjonalne — nazwa tablicy ALBO board id. Fuzzy match.",
        },
        assignee: {
          type: "string",
          description:
            "Opcjonalne — imię/email/id osoby przypisanej. 'ME' = zalogowany user.",
        },
        limit: { type: "number" },
      },
      required: [],
    },
  },
  {
    name: "get_user_activity",
    description:
      "Zwraca aktywność danego użytkownika z ostatnich X dni — edytował, tworzył, " +
      "komentował, zmieniał status zadań. Dane z AuditLog. " +
      "Użyj gdy user pyta 'co X robił', 'aktywność Y', 'co się działo z X', 'co dziś zrobił X'.",
    parameters: {
      type: "object",
      properties: {
        userIdOrName: {
          type: "string",
          description:
            "Imię/nazwisko/email/id użytkownika. Robimy fuzzy match. 'ME' = zalogowany user.",
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
      case "find_user":
        return { ok: true, data: await toolFindUser(ctx, args) };
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

// ─────────── Pomocnik: getAccessibleBoardIds ──────────────────────────────

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

// ─────────── Pomocnik: resolveBoardId (cuid lub nazwa) ────────────────────
// Zwraca pasujący board.id albo null. Strategia:
//   1. Jeśli string wygląda jak cuid (24-30 znaków, alfanum) i jest w
//      accessibleBoards → użyj go.
//   2. W przeciwnym razie fuzzy contains po board.name (case-insensitive),
//      jeśli jeden match → użyj. Wiele → null + lista kandydatów.

async function resolveBoardId(
  ctx: ToolContext,
  query: string,
): Promise<
  | { found: true; boardId: string; name: string }
  | { found: false; candidates: { id: string; name: string }[] }
> {
  const accessible = await getAccessibleBoardIds(ctx);
  if (accessible.length === 0) return { found: false, candidates: [] };

  // Direct ID hit (cuid match).
  if (accessible.includes(query)) {
    const b = await db.board.findUnique({
      where: { id: query },
      select: { name: true },
    });
    if (b) return { found: true, boardId: query, name: b.name };
  }

  // Fuzzy name match.
  const matches = await db.board.findMany({
    where: {
      id: { in: accessible },
      name: { contains: query, mode: "insensitive" },
    },
    select: { id: true, name: true },
    take: 10,
  });

  if (matches.length === 1) {
    return { found: true, boardId: matches[0].id, name: matches[0].name };
  }
  return { found: false, candidates: matches };
}

// ─────────── Pomocnik: resolveUserId (cuid, nazwa lub 'ME') ───────────────

async function resolveUserId(
  ctx: ToolContext,
  query: string,
): Promise<
  | { found: true; userId: string; name: string; email: string }
  | { found: false; candidates: { id: string; name: string | null; email: string }[] }
> {
  // Sygnatura 'ME' = zalogowany user.
  if (query.toUpperCase() === "ME") {
    const me = await db.user.findUnique({
      where: { id: ctx.userId },
      select: { id: true, name: true, email: true },
    });
    if (me) {
      return {
        found: true,
        userId: me.id,
        name: me.name ?? me.email.split("@")[0],
        email: me.email,
      };
    }
  }

  // Members tego workspace'u.
  const members = await db.user.findMany({
    where: {
      memberships: { some: { workspaceId: ctx.workspaceId } },
    },
    select: { id: true, name: true, email: true },
  });

  // Direct id hit.
  const byId = members.find((u) => u.id === query);
  if (byId) {
    return {
      found: true,
      userId: byId.id,
      name: byId.name ?? byId.email.split("@")[0],
      email: byId.email,
    };
  }

  // Fuzzy match — name lub email contains (case-insensitive).
  const lc = query.toLowerCase();
  const matches = members.filter((u) => {
    const name = (u.name ?? "").toLowerCase();
    const email = u.email.toLowerCase();
    return name.includes(lc) || email.includes(lc);
  });

  if (matches.length === 1) {
    return {
      found: true,
      userId: matches[0].id,
      name: matches[0].name ?? matches[0].email.split("@")[0],
      email: matches[0].email,
    };
  }

  return {
    found: false,
    candidates: matches.slice(0, 5).map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
    })),
  };
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

// ─────────── Tool: find_user ──────────────────────────────────────────────

async function toolFindUser(ctx: ToolContext, args: Record<string, unknown>) {
  const query = typeof args.query === "string" ? args.query.trim() : "";
  if (!query) return { count: 0, users: [], error: "Brak query." };

  const lc = query.toLowerCase();
  const members = await db.user.findMany({
    where: {
      memberships: { some: { workspaceId: ctx.workspaceId } },
    },
    select: { id: true, name: true, email: true },
  });

  const matches = members.filter((u) => {
    const name = (u.name ?? "").toLowerCase();
    const email = u.email.toLowerCase();
    return name.includes(lc) || email.includes(lc) || u.id === query;
  });

  return {
    count: matches.length,
    users: matches.slice(0, 10).map((u) => ({
      id: u.id,
      name: u.name ?? u.email.split("@")[0],
      email: u.email,
    })),
  };
}

// ─────────── Tool: list_tasks ──────────────────────────────────────────────

async function toolListTasks(ctx: ToolContext, args: Record<string, unknown>) {
  const boardQuery = typeof args.board === "string" ? args.board.trim() : undefined;
  const assigneeQuery =
    typeof args.assignee === "string" ? args.assignee.trim() : undefined;
  const statusFilter =
    typeof args.status === "string" ? args.status.toLowerCase() : undefined;
  const includeCompleted = args.includeCompleted === true;
  const limit = Math.min(
    50,
    typeof args.limit === "number" && args.limit > 0 ? args.limit : 30,
  );

  const accessibleBoards = await getAccessibleBoardIds(ctx);
  if (accessibleBoards.length === 0) return { count: 0, tasks: [] };

  // Resolve board (jeśli podano).
  let boardId: string | undefined;
  let boardName: string | undefined;
  if (boardQuery) {
    const resolved = await resolveBoardId(ctx, boardQuery);
    if (!resolved.found) {
      return {
        count: 0,
        tasks: [],
        note: `Nie znaleziono jednoznacznie tablicy pasującej do "${boardQuery}".`,
        candidates: resolved.candidates,
      };
    }
    boardId = resolved.boardId;
    boardName = resolved.name;
  }

  // Resolve assignee (jeśli podano).
  let assigneeUserId: string | undefined;
  let assigneeName: string | undefined;
  if (assigneeQuery) {
    const resolved = await resolveUserId(ctx, assigneeQuery);
    if (!resolved.found) {
      return {
        count: 0,
        tasks: [],
        note: `Nie znaleziono jednoznacznie użytkownika pasującego do "${assigneeQuery}".`,
        candidates: resolved.candidates,
      };
    }
    assigneeUserId = resolved.userId;
    assigneeName = resolved.name;
  }

  const tasks = await db.task.findMany({
    where: {
      workspaceId: ctx.workspaceId,
      deletedAt: null,
      boardId: boardId ?? { in: accessibleBoards },
      ...(includeCompleted ? {} : { timerCompletedAt: null }),
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

  const filtered = statusFilter
    ? tasks.filter((t) =>
        t.statusColumn?.name.toLowerCase().includes(statusFilter),
      )
    : tasks;

  return {
    count: filtered.length,
    filters: {
      board: boardName ?? null,
      assignee: assigneeName ?? null,
      status: statusFilter ?? null,
      includeCompleted,
    },
    tasks: filtered.map((t) => ({
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
  const boardQuery = typeof args.board === "string" ? args.board.trim() : undefined;
  const assigneeQuery =
    typeof args.assignee === "string" ? args.assignee.trim() : undefined;
  const limit = Math.min(
    50,
    typeof args.limit === "number" && args.limit > 0 ? args.limit : 30,
  );

  const accessibleBoards = await getAccessibleBoardIds(ctx);
  if (accessibleBoards.length === 0) return { count: 0, tasks: [] };

  let boardId: string | undefined;
  let boardName: string | undefined;
  if (boardQuery) {
    const resolved = await resolveBoardId(ctx, boardQuery);
    if (!resolved.found) {
      return {
        count: 0,
        tasks: [],
        note: `Nie znaleziono tablicy "${boardQuery}".`,
        candidates: resolved.candidates,
      };
    }
    boardId = resolved.boardId;
    boardName = resolved.name;
  }

  let assigneeUserId: string | undefined;
  let assigneeName: string | undefined;
  if (assigneeQuery) {
    const resolved = await resolveUserId(ctx, assigneeQuery);
    if (!resolved.found) {
      return {
        count: 0,
        tasks: [],
        note: `Nie znaleziono użytkownika "${assigneeQuery}".`,
        candidates: resolved.candidates,
      };
    }
    assigneeUserId = resolved.userId;
    assigneeName = resolved.name;
  }

  const now = new Date();
  const tasks = await db.task.findMany({
    where: {
      workspaceId: ctx.workspaceId,
      deletedAt: null,
      boardId: boardId ?? { in: accessibleBoards },
      stopAt: { lt: now },
      timerCompletedAt: null,
      ...(assigneeUserId
        ? { assignees: { some: { userId: assigneeUserId } } }
        : {}),
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
    filters: {
      board: boardName ?? null,
      assignee: assigneeName ?? null,
    },
    tasks: tasks.map((t) => ({
      displayId: t.displayId,
      title: t.title,
      board: t.board.name,
      status: t.statusColumn?.name ?? null,
      deadline: t.stopAt?.toISOString() ?? null,
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
  const query =
    typeof args.userIdOrName === "string" ? args.userIdOrName.trim() : "";
  if (!query) return { count: 0, events: [], error: "Brak userIdOrName." };

  const days = Math.min(
    30,
    typeof args.days === "number" && args.days > 0 ? args.days : 7,
  );
  const limit = Math.min(
    50,
    typeof args.limit === "number" && args.limit > 0 ? args.limit : 30,
  );

  const resolved = await resolveUserId(ctx, query);
  if (!resolved.found) {
    return {
      count: 0,
      events: [],
      note: `Nie znaleziono użytkownika pasującego do "${query}".`,
      candidates: resolved.candidates,
    };
  }

  const since = new Date(Date.now() - days * 86_400_000);

  const events = await db.auditLog.findMany({
    where: {
      workspaceId: ctx.workspaceId,
      actorId: resolved.userId,
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
      name: resolved.name,
      email: resolved.email,
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
