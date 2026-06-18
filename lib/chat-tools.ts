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
      "Zwraca SZCZEGÓŁOWĄ listę zadań (max 30 najnowszych). Filtruje po tablicy/osobie/statusie. " +
      "Domyślnie EXCLUDE ukończonych. " +
      "UŻYJ TYLKO gdy user chce zobaczyć TYTUŁY/DETALE zadań ('pokaż zadania', 'co robi Y', " +
      "'co mam do zrobienia w X'). " +
      "Gdy odpowiedź zawiera 'truncated: true' — TO ZNACZY że jest WIĘCEJ zadań niż pokazane. " +
      "DO LICZENIA ('ile zadań', 'ile mam do zrobienia') używaj count_tasks_by_status — daje " +
      "PEŁNE liczby bez obcinania.",
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
    name: "count_tasks_by_status",
    description:
      "Zwraca DOKŁADNE liczby zadań pogrupowane po statusie (Do zrobienia: 3, Testy: 15, Done: 21 itd). " +
      "Bez obcinania, bez próbek — agregacja po stronie bazy. " +
      "UŻYJ ZAWSZE gdy user pyta 'ILE zadań', 'ile mam do zrobienia', 'ile w trakcie', " +
      "'ile zostało', 'ile w testach'. NIE używaj list_tasks do liczenia — zwraca tylko 30 próbek.",
    parameters: {
      type: "object",
      properties: {
        board: {
          type: "string",
          description:
            "Opcjonalna nazwa tablicy ALBO board id. Fuzzy match. Bez tego = wszystkie tablice usera.",
        },
        assignee: {
          type: "string",
          description:
            "Opcjonalne — imię/email/id osoby. 'ME' = zalogowany user. " +
            "Gdy podane, liczymy tylko zadania przypisane do tej osoby.",
        },
        includeCompleted: {
          type: "boolean",
          description: "Default false — pomijamy ukończone (timerCompletedAt set).",
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
      case "count_tasks_by_status":
        return { ok: true, data: await toolCountTasksByStatus(ctx, args) };
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
  // M3: trim'ujemy zanim sprawdzimy ME (LLM często wysyła "ME " z trailing).
  // Sygnatura 'ME' = zalogowany user.
  if (query.trim().toUpperCase() === "ME") {
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
  // C3: min 2 znaki — pojedyncza litera dopasowuje prawie wszystkich userów,
  // i wszystkie ich emaile wpadałyby do logów LLM provider'a (PII leak).
  if (query.length < 2) {
    return {
      count: 0,
      users: [],
      error: "Podaj min 2 znaki imienia / nazwiska.",
    };
  }

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

  // C3: NIE zwracamy pełnego email'a do LLM'a — wystarczy local-part (przed @)
  // jako disambiguator. Pełen adres redundantny, tylko zwiększał PII surface.
  return {
    count: matches.length,
    users: matches.slice(0, 10).map((u) => ({
      id: u.id,
      name: u.name ?? u.email.split("@")[0],
      emailHandle: u.email.split("@")[0],
    })),
  };
}

// ─────────── Tool: count_tasks_by_status ──────────────────────────────────
// Exact COUNT(*) per status — bez próbkowania. Używamy gdy LLM pyta "ile zadań".
// Reusable helper resolveBoardId + resolveUserId tu nie spodleja — agregat
// idzie przez raw groupBy Prismy.

async function toolCountTasksByStatus(
  ctx: ToolContext,
  args: Record<string, unknown>,
) {
  const boardQuery = typeof args.board === "string" ? args.board.trim() : undefined;
  const assigneeQuery =
    typeof args.assignee === "string" ? args.assignee.trim() : undefined;
  const includeCompleted = args.includeCompleted === true;

  const accessibleBoards = await getAccessibleBoardIds(ctx);
  if (accessibleBoards.length === 0) {
    return { totalCount: 0, byStatus: [] };
  }

  let boardId: string | undefined;
  let boardName: string | undefined;
  if (boardQuery) {
    const resolved = await resolveBoardId(ctx, boardQuery);
    if (!resolved.found) {
      return {
        totalCount: 0,
        byStatus: [],
        note: `Nie znalazłem tablicy "${boardQuery}".`,
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
        totalCount: 0,
        byStatus: [],
        note: `Nie znalazłem użytkownika "${assigneeQuery}".`,
        candidates: resolved.candidates,
      };
    }
    assigneeUserId = resolved.userId;
    assigneeName = resolved.name;
  }

  // groupBy(statusColumnId) → liczy task'i per status w jednym query.
  const grouped = await db.task.groupBy({
    by: ["statusColumnId"],
    where: {
      workspaceId: ctx.workspaceId,
      deletedAt: null,
      boardId: boardId ?? { in: accessibleBoards },
      ...(includeCompleted ? {} : { timerCompletedAt: null }),
      ...(assigneeUserId
        ? { assignees: { some: { userId: assigneeUserId } } }
        : {}),
    },
    _count: { _all: true },
  });

  // Pobierz nazwy statusów (1 dodatkowy query).
  const statusIds = grouped
    .map((g) => g.statusColumnId)
    .filter((id): id is string => id !== null);
  const statuses =
    statusIds.length > 0
      ? await db.statusColumn.findMany({
          where: { id: { in: statusIds } },
          select: { id: true, name: true, colorHex: true, order: true },
        })
      : [];
  const statusById = new Map(statuses.map((s) => [s.id, s]));

  // Build byStatus z null'ami ("Bez statusu") na końcu.
  const byStatus = grouped
    .map((g) => {
      const s = g.statusColumnId ? statusById.get(g.statusColumnId) : null;
      return {
        statusName: s?.name ?? "Bez statusu",
        statusOrder: s?.order ?? 9999,
        count: g._count._all,
      };
    })
    .sort((a, b) => a.statusOrder - b.statusOrder)
    .map((s) => ({ name: s.statusName, count: s.count }));

  const totalCount = byStatus.reduce((sum, s) => sum + s.count, 0);

  return {
    totalCount,
    filters: {
      board: boardName ?? null,
      assignee: assigneeName ?? null,
      includeCompleted,
    },
    byStatus,
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

  // Wspólny WHERE clause — używamy też do count'a żeby wiedzieć czy
  // obcięliśmy listę.
  const whereClause = {
    workspaceId: ctx.workspaceId,
    deletedAt: null,
    boardId: boardId ?? { in: accessibleBoards },
    ...(includeCompleted ? {} : { timerCompletedAt: null }),
    ...(assigneeUserId
      ? { assignees: { some: { userId: assigneeUserId } } }
      : {}),
  };

  // Total count (bez limita) + slice 30 najnowszych — równolegle.
  const [totalAvailable, tasks] = await Promise.all([
    db.task.count({ where: whereClause }),
    db.task.findMany({
      where: whereClause,
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
    }),
  ]);

  const filtered = statusFilter
    ? tasks.filter((t) =>
        t.statusColumn?.name.toLowerCase().includes(statusFilter),
      )
    : tasks;

  const truncated = totalAvailable > filtered.length;

  return {
    count: filtered.length,
    totalAvailable,
    truncated,
    note: truncated
      ? `Pokazuję ${filtered.length} najnowszych z ${totalAvailable} pasujących. Do DOKŁADNYCH liczb użyj count_tasks_by_status.`
      : null,
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

  // C5 fix: lookup tasków/board'ów MUSI respektować ACL pytającego usera,
  // nie target'u. Inaczej user A widzi tytuły z PRIVATE board'ów do których
  // nie ma membershipu — tylko dlatego że user B (też w workspace'ie) tam
  // coś robił.
  const accessibleBoardIds = await getAccessibleBoardIds(ctx);
  const [tasks, boards] = await Promise.all([
    taskIds.length > 0
      ? db.task.findMany({
          where: {
            id: { in: taskIds },
            workspaceId: ctx.workspaceId,
            boardId: { in: accessibleBoardIds },
          },
          select: { id: true, title: true, displayId: true },
        })
      : Promise.resolve([]),
    boardIds.length > 0
      ? db.board.findMany({
          where: {
            id: { in: boardIds },
            workspaceId: ctx.workspaceId,
            // Board lookup ograniczamy do tych do których pytający user ma dostęp.
            // Reszta wpadnie do "(brak dostępu)" w label'u eventa poniżej.
          },
          select: { id: true, name: true, visibility: true },
        })
      : Promise.resolve([]),
  ]);
  const taskById = new Map(tasks.map((t) => [t.id, t]));
  // Board: filter PRIVATE'y do których pytający nie ma dostępu — używamy
  // accessibleBoardIds set, żeby PRIVATE board's name nie wyciekał.
  const accessibleBoardsSet = new Set(accessibleBoardIds);
  const boardById = new Map(
    boards
      .filter((b) => accessibleBoardsSet.has(b.id))
      .map((b) => [b.id, b]),
  );

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
          ? taskById.get(e.objectId)?.title ?? "(brak dostępu lub usunięte)"
          : e.objectType === "Board"
            ? boardById.get(e.objectId)?.name ?? "(brak dostępu lub usunięte)"
            : "(inny obiekt)",
      // NIE pokazujemy raw e.objectId (cuid) gdy nie ma label'a — leakuje
      // istnienie obiektów do których user nie ma dostępu.
      at: e.createdAt.toISOString(),
    })),
  };
}
