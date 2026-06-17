// F12-K74 Czesiek AI — main chat endpoint.
//
// POST /api/chat
//   body: { workspaceId, sessionId?, message }
//   returns: { sessionId, messages: ChatMessage[] }
//
// Agentic loop:
//   1. Auth + workspace membership check.
//   2. Resolve / create ChatSession.
//   3. Load last ~20 messages z DB (context window).
//   4. Save new user message.
//   5. Loop max 5 iteracji:
//      - call LLM(history + tools)
//      - jeśli tool_calls → executeChatTool dla każdego → tool result message
//      - jeśli plain text → save assistant message + break
//   6. Update session.title (gdy pusty) + lastModel.
//
// Wszystkie wiadomości persistowane do DB w czasie rzeczywistym żeby
// w razie crashy partial conversation była zachowana.

import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { chat, type ChatMessageInput } from "@/lib/llm";
import { TOOL_DEFS, executeChatTool, type ToolContext } from "@/lib/chat-tools";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const POST_SCHEMA = z.object({
  workspaceId: z.string().min(1),
  sessionId: z.string().min(1).optional(),
  message: z.string().min(1).max(4000),
});

// Trzymamy mniej historii dla szybszego LLM call'a (mniej tokenów input).
// Trade-off: model nie pamięta starych konwersacji w tej sesji.
const MAX_HISTORY_MESSAGES = 12;
const MAX_TOOL_ITERATIONS = 5;

function buildSystemPrompt(currentUserLabel: string): string {
  // Krótki, zwięzły prompt — fewer tokens = faster LLM call.
  return `Jesteś Ateron — asystent AI w aplikacji FLOVLY (system PM klasy ClickUp).

Z tobą rozmawia: ${currentUserLabel}. Pytanie "co mam do zrobienia" = dotyczy tej osoby.

TOOLS — parametry assignee/board AKCEPTUJĄ IMIONA i NAZWY (np. assignee="Kuba", board="P&R"). NIE rób wcześniej lookup'ów.
- list_boards: lista projektów
- find_user: szuka osoby po imieniu (gdy potrzebujesz pewności)
- list_tasks: zadania (default = bez ukończonych; assignee="ME" = zalogowany user)
- list_overdue_tasks: przeterminowane
- get_user_activity: co user robił (AuditLog)

ZASADY:
- Wywołuj tools RÓWNOLEGLE gdy potrzebujesz wielu danych (np. list_tasks dla 2 osób).
- Tool zwraca \`candidates\` (kilka pasujących) → DOPYTAJ usera, nie zgaduj.
- Tool zwraca pusty wynik bez \`candidates\` → szczerze "nie znalazłem".

FORMAT: po polsku, krótko, listy "#42 — tytuł (status, deadline)". Daty czytelnie. Nigdy nie pokazuj cuid'ów.`;
}

async function getWorkspaceSession(workspaceId: string, userId: string) {
  return db.workspaceMembership.findFirst({
    where: { workspaceId, userId, workspace: { deletedAt: null } },
    select: { role: true },
  });
}

export async function POST(request: Request) {
  // ─────────── Auth ───────────
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = POST_SCHEMA.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { workspaceId, message } = parsed.data;
  let { sessionId } = parsed.data;
  const userId = session.user.id;

  // ─────────── Workspace membership + user label dla system prompt'a ─
  const membership = await getWorkspaceSession(workspaceId, userId);
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Pobieramy imię + email zalogowanego usera żeby LLM wiedział "kto pyta".
  const currentUser = await db.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  });
  const currentUserLabel = currentUser
    ? `${currentUser.name ?? currentUser.email.split("@")[0]} (${currentUser.email})`
    : "Anonimowy user";

  // ─────────── Resolve / create ChatSession ───────────
  let chatSession;
  if (sessionId) {
    chatSession = await db.chatSession.findFirst({
      where: { id: sessionId, workspaceId, userId },
    });
    if (!chatSession) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 },
      );
    }
  } else {
    chatSession = await db.chatSession.create({
      data: { workspaceId, userId },
    });
    sessionId = chatSession.id;
  }

  // ─────────── Save user message ───────────
  await db.chatMessage.create({
    data: { sessionId, role: "user", content: message },
  });

  // ─────────── Load history ───────────
  const history = await db.chatMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
    take: MAX_HISTORY_MESSAGES + 5,
  });

  // Konwersja DB rows → ChatMessageInput dla LLM'a.
  const llmHistory: ChatMessageInput[] = [
    { role: "system", content: buildSystemPrompt(currentUserLabel) },
    ...history.slice(-MAX_HISTORY_MESSAGES).map((m) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tc = (m.toolCalls as any[] | null) ?? undefined;
      return {
        role: m.role as ChatMessageInput["role"],
        content: m.content,
        toolCalls: tc?.map((c) => ({
          id: c.id,
          name: c.name,
          arguments: c.arguments,
        })),
        toolCallId: m.toolCallId ?? undefined,
        toolName: m.toolName ?? undefined,
      };
    }),
  ];

  const toolCtx: ToolContext = { workspaceId, userId };
  let lastModel: string | null = null;
  const startedAt = Date.now();

  // ─────────── Agentic loop ───────────
  for (let iter = 0; iter < MAX_TOOL_ITERATIONS; iter++) {
    let result;
    try {
      result = await chat(llmHistory, TOOL_DEFS);
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      console.error(`[/api/chat] LLM error: ${errMsg}`);
      // NIE zapisujemy error message do DB — tylko zwracamy 503. Klient
      // pokaże transient error bubble (znika po następnym successful
      // response). Bez tego user widziałby DWIE wiadomości błędu (saved
      // w DB + client-side transient).
      return NextResponse.json(
        {
          error: "LLM unavailable",
          message: errMsg,
        },
        { status: 503 },
      );
    }
    lastModel = result.model;

    if (result.toolCalls.length === 0) {
      // Plain odpowiedź — zapisujemy i kończymy.
      await db.chatMessage.create({
        data: {
          sessionId,
          role: "assistant",
          content: result.content,
          tokensIn: result.tokensIn,
          tokensOut: result.tokensOut,
          latencyMs: result.latencyMs,
        },
      });
      llmHistory.push({ role: "assistant", content: result.content });
      break;
    }

    // Tool calls — zapisz assistant message z toolCalls, wykonaj każdy
    // tool, zapisz wyniki, push do history, kontynuuj loop.
    await db.chatMessage.create({
      data: {
        sessionId,
        role: "assistant",
        content: result.content,
        toolCalls: result.toolCalls.map((c) => ({
          id: c.id,
          name: c.name,
          arguments: c.arguments,
        })),
        tokensIn: result.tokensIn,
        tokensOut: result.tokensOut,
        latencyMs: result.latencyMs,
      },
    });
    llmHistory.push({
      role: "assistant",
      content: result.content,
      toolCalls: result.toolCalls,
    });

    // Wykonujemy WSZYSTKIE tool calls z tego turn'a RÓWNOLEGLE. LLM
    // zwraca je w jednym message gdy są niezależne (np. list_tasks dla
    // 2 różnych board'ów) — sekwencyjne wykonanie zżerało N*200-500ms,
    // równoległe ~max(200-500ms). Po wykonaniu push'ujemy w oryginalnej
    // kolejności żeby LLM widział match między tool_call_id ↔ tool_result.
    const toolStart = Date.now();
    const toolResults = await Promise.all(
      result.toolCalls.map((call) => executeChatTool(call.name, call.arguments, toolCtx)),
    );
    const toolDuration = Date.now() - toolStart;
    console.log(
      `[chat] iter ${iter} — ${result.toolCalls.length} tools w ${toolDuration}ms (LLM ${result.latencyMs}ms, model ${result.model})`,
    );

    // Save tool messages + push do history w oryginalnej kolejności.
    await Promise.all(
      result.toolCalls.map((call, idx) => {
        const serialized = JSON.stringify(toolResults[idx]);
        return db.chatMessage.create({
          data: {
            sessionId,
            role: "tool",
            content: serialized,
            toolCallId: call.id,
            toolName: call.name,
          },
        });
      }),
    );
    for (let idx = 0; idx < result.toolCalls.length; idx++) {
      const call = result.toolCalls[idx];
      llmHistory.push({
        role: "tool",
        content: JSON.stringify(toolResults[idx]),
        toolCallId: call.id,
        toolName: call.name,
      });
    }
  }

  console.log(`[chat] total ${Date.now() - startedAt}ms (model ${lastModel})`);

  // ─────────── Update session metadata ───────────
  const titleNeedsUpdate = chatSession.title === "Nowa rozmowa";
  await db.chatSession.update({
    where: { id: sessionId },
    data: {
      lastModel,
      updatedAt: new Date(),
      ...(titleNeedsUpdate
        ? { title: message.slice(0, 60).replace(/\s+/g, " ").trim() }
        : {}),
    },
  });

  // ─────────── Return updated messages ───────────
  const updated = await db.chatMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      role: true,
      content: true,
      toolName: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    sessionId,
    messages: updated.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      toolName: m.toolName,
      createdAt: m.createdAt.toISOString(),
    })),
  });
}
