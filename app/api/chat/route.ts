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

const MAX_HISTORY_MESSAGES = 20;
const MAX_TOOL_ITERATIONS = 5;

function buildSystemPrompt(currentUserLabel: string): string {
  return `Jesteś Ateron — wbudowany asystent AI w aplikacji FLOVLY (system zarządzania projektami klasy ClickUp/Linear).

KONTEKST:
- Z tobą rozmawia: ${currentUserLabel}. Gdy ktoś pyta "co mam do zrobienia" / "moje zadania" — chodzi o tę osobę.
- Pracujesz w obrębie JEDNEGO workspace'u (system go automatycznie podsuwa do tools).

TWOJE NARZĘDZIA (tools) — i jak ich używać:
1. list_boards — lista wszystkich tablic/projektów. Wywołuj gdy user pyta jakie ma projekty.
2. find_user — szukanie osoby po IMIENIU (np. "Kuba" → znajdzie usera). UŻYJ ZAWSZE gdy user wymienia kogoś po imieniu, ZANIM filtrujesz zadania po tej osobie.
3. list_tasks — zadania z filtrami board / assignee / status. Parametry assignee/board akceptują IMIONA i NAZWY (np. assignee="Kuba" zadziała, board="P&R Flovly" zadziała). NIE musisz wcześniej szukać id — tools robią to same.
4. list_overdue_tasks — przeterminowane (analogicznie z filtrami).
5. get_user_activity — co dany user robił (z AuditLog).

KLUCZOWE ZASADY:
- Gdy user pyta "co ma do zrobienia Kuba w projekcie X" → wywołaj BEZPOŚREDNIO list_tasks z assignee="Kuba" i board="X". Tools resolve'ują nazwy.
- Gdy user pyta "co mam do zrobienia" / "moje zadania" → wywołaj list_tasks z assignee="ME" (specjalne słowo = zalogowany user).
- list_tasks domyślnie WYKLUCZA ukończone zadania. Gdy user wprost pyta o "wszystkie łącznie z zamkniętymi" → includeCompleted=true.
- Gdy tool zwróci pole \`candidates\` (znaleziono wielu kandydatów albo żadnego pasującego) — DOPYTAJ usera "który masz na myśli? Pasują: A, B, C" zamiast zgadywać.
- Gdy tool zwróci pusty array i NIE ma \`candidates\` — to znaczy NIE MA pasujących danych. Powiedz szczerze "Nie znalazłem zadań spełniających kryteria".

FORMAT ODPOWIEDZI:
- ZAWSZE po polsku, naturalnie, krótko.
- Listy: "1. #42 — tytuł zadania (status, deadline)".
- Nigdy nie pokazuj cuid'ów. Używaj displayId (#42) i nazw.
- Daty czytelnie ("wczoraj", "3 dni temu", "15 czerwca") — nie ISO 8601.`;
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

  // ─────────── Agentic loop ───────────
  for (let iter = 0; iter < MAX_TOOL_ITERATIONS; iter++) {
    let result;
    try {
      result = await chat(llmHistory, TOOL_DEFS);
    } catch (e) {
      console.error("[/api/chat] LLM error", e);
      // Save error message tak żeby user widział co poszło nie tak.
      await db.chatMessage.create({
        data: {
          sessionId,
          role: "assistant",
          content:
            "Przepraszam, Ateron nie może teraz odpowiedzieć — wystąpił problem z połączeniem do AI. Spróbuj za chwilę.",
        },
      });
      return NextResponse.json(
        {
          error: "LLM unavailable",
          message: e instanceof Error ? e.message : "unknown",
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

    for (const call of result.toolCalls) {
      const toolResult = await executeChatTool(call.name, call.arguments, toolCtx);
      const serialized = JSON.stringify(toolResult);
      await db.chatMessage.create({
        data: {
          sessionId,
          role: "tool",
          content: serialized,
          toolCallId: call.id,
          toolName: call.name,
        },
      });
      llmHistory.push({
        role: "tool",
        content: serialized,
        toolCallId: call.id,
        toolName: call.name,
      });
    }
  }

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
