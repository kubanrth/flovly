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
import { checkLimit } from "@/lib/rate-limit";

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

// H7: user może mieć w name newliny / fake "SYSTEM:" prefix → injection.
// Twardy sanitize: jednolinijka, max 80 znaków, escapuje '<' żeby user nie
// wstawił </user> i nie zamknął naszego delimitera.
function sanitizeUserLabel(s: string): string {
  return s
    .replace(/[\n\r\t<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

function buildSystemPrompt(currentUserLabel: string): string {
  return `Jesteś Ateron — asystent AI w aplikacji FLOVLY (system PM klasy ClickUp).

Z tobą rozmawia: ${currentUserLabel}. Pytanie "co mam do zrobienia" = dotyczy tej osoby.

TOOLS — parametry assignee/board AKCEPTUJĄ IMIONA i NAZWY (np. assignee="Kuba", board="P&R"). NIE rób wcześniej lookup'ów.
- list_boards: lista projektów
- find_user: szuka osoby po imieniu (gdy potrzebujesz pewności)
- count_tasks_by_status: DOKŁADNE LICZBY zadań pogrupowane po statusie
- list_tasks: SZCZEGÓŁOWA lista (max 30 najnowszych — ZNA tylko próbkę!)
- list_overdue_tasks: przeterminowane
- get_user_activity: co user robił (AuditLog)

KRYTYCZNA ZASADA — LICZENIE vs LISTOWANIE:
- Gdy user pyta "ILE zadań" / "ile mam do zrobienia" / "ile w testach" → UŻYJ count_tasks_by_status. Daje exact liczby z całej bazy.
- Gdy user pyta "POKAŻ zadania" / "jakie zadania" / "co mam do zrobienia" → użyj list_tasks (zwraca tytuły, ale tylko 30 próbek).
- NIGDY nie licz po list_tasks. Jeśli wynik ma "truncated: true" — to NIE jest pełna lista, jest WIĘCEJ ukrytych zadań.

INNE ZASADY:
- Wywołuj tools RÓWNOLEGLE gdy potrzebujesz wielu danych (np. count + list).
- Tool zwraca \`candidates\` → DOPYTAJ usera, nie zgaduj.
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

  const { message } = parsed.data;
  let { sessionId } = parsed.data;
  const userId = session.user.id;
  // workspaceId z BODY tylko dla NOWEJ sesji. Dla istniejącej zawsze
  // bierzemy z chatSession.workspaceId — eliminuje cross-workspace takeover (C2).
  let workspaceId = parsed.data.workspaceId;

  // ─────────── Resolve / create ChatSession (PRZED workspace check) ───────
  // C2 fix: gdy istniejąca sesja, walidujemy SAM userId (właściciel) i
  // nadpisujemy workspaceId tym z sesji. Body workspaceId ignorowane.
  let chatSession;
  if (sessionId) {
    chatSession = await db.chatSession.findFirst({
      where: { id: sessionId, userId },
      select: { id: true, workspaceId: true, title: true },
    });
    if (!chatSession) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 },
      );
    }
    // C2: użyj workspaceId z sesji, nie z body.
    workspaceId = chatSession.workspaceId;
  }

  // ─────────── Workspace membership ───────────
  const membership = await getWorkspaceSession(workspaceId, userId);
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ─────────── C1: Rate limit (per user+workspace) ───────────
  // Sliding-window minute + daily total.
  const rateKey = `${userId}:${workspaceId}`;
  const [perMin, perDay] = await Promise.all([
    checkLimit("chat.message", rateKey),
    checkLimit("chat.daily", rateKey),
  ]);
  if (!perMin.ok) {
    return NextResponse.json(
      { error: "Rate limit", message: perMin.error, resetMs: perMin.resetMs },
      { status: 429 },
    );
  }
  if (!perDay.ok) {
    return NextResponse.json(
      { error: "Daily limit", message: perDay.error, resetMs: perDay.resetMs },
      { status: 429 },
    );
  }

  // Pobieramy imię + email zalogowanego usera żeby LLM wiedział "kto pyta".
  const currentUser = await db.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  });
  // H7: sanitize żeby user nie wstrzyknął fake "SYSTEM:" w nazwę.
  const currentUserLabel = currentUser
    ? `${sanitizeUserLabel(currentUser.name ?? currentUser.email.split("@")[0])} (${sanitizeUserLabel(currentUser.email)})`
    : "Anonimowy user";

  // Create new session (po wszystkich check'ach żeby nie tworzyć orphan'ów).
  if (!chatSession) {
    chatSession = await db.chatSession.create({
      data: { workspaceId, userId },
      select: { id: true, workspaceId: true, title: true },
    });
    sessionId = chatSession.id;
  }
  // Po tym punkcie sessionId jest na pewno stringiem (utworzona albo
  // istniejąca). TS nie wnioskuje przez branch'e więc explicit assignment.
  const sid: string = chatSession.id;

  // ─────────── Save user message ───────────
  await db.chatMessage.create({
    data: { sessionId: sid, role: "user", content: message },
  });

  // ─────────── Load history ───────────
  // H1 fix: pobieramy NAJNOWSZE MAX_HISTORY_MESSAGES (DESC), potem reverse'em
  // przywracamy chronologię. Bug: wcześniej `orderBy: asc + take` zwracało
  // NAJSTARSZE 12 messages → po pierwszych 12 wiadomościach model "tracił
  // pamięć" o aktualnej konwersacji.
  const history = await db.chatMessage.findMany({
    where: { sessionId: sid },
    orderBy: { createdAt: "desc" },
    take: MAX_HISTORY_MESSAGES,
  });

  const llmHistory: ChatMessageInput[] = [
    { role: "system", content: buildSystemPrompt(currentUserLabel) },
    ...history.reverse().map((m) => {
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
          sessionId: sid,
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
        sessionId: sid,
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
            sessionId: sid,
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
    where: { id: sid },
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
    where: { sessionId: sid },
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
    sessionId: sid,
    messages: updated.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      toolName: m.toolName,
      createdAt: m.createdAt.toISOString(),
    })),
  });
}
