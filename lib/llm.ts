// F12-K74 Czesiek AI — LLM adapter (Groq primary + OpenAI fallback).
//
// Groq i OpenAI używają tej samej tool-calling spec (OpenAI-compatible),
// więc tools przekazujemy 1:1. Groq idzie pierwszy bo: free tier do 14400
// req/dzień, latencja ~200-500ms (vs 1-3s OpenAI), nasz default na Llama
// 3.3 70B Versatile.
//
// Fallback chain:
//   1) Groq (llama-3.3-70b-versatile)
//   2) OpenAI (gpt-4o-mini) — tylko jeśli OPENAI_API_KEY ustawiony
//   3) throw — UI pokazuje "Czesiek niedostępny, spróbuj za chwilę"
//
// Każdy provider zwraca ten sam ChatResult — UI/route handler nie wie
// który model zwrócił odpowiedź (poza polem `model` do telemetrii).

import Groq from "groq-sdk";

export type ChatRole = "system" | "user" | "assistant" | "tool";

export type ChatMessageInput = {
  role: ChatRole;
  content: string;
  // OpenAI/Groq tool-call spec:
  // assistant message niesie tool_calls (array), tool message niesie tool_call_id.
  toolCalls?: Array<{
    id: string;
    name: string;
    arguments: string; // JSON-stringified args
  }>;
  toolCallId?: string;
  toolName?: string;
};

export type ChatTool = {
  name: string;
  description: string;
  // JSON Schema for arguments
  parameters: Record<string, unknown>;
};

export type ChatToolCall = {
  id: string;
  name: string;
  arguments: string;
};

export type ChatResult = {
  content: string;
  toolCalls: ChatToolCall[];
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
  model: string;
  provider: "groq" | "openai";
  finishReason: string;
};

// Domyślnie llama-3.3-70b-versatile (najlepsza jakość tool calling).
// Override via env GROQ_MODEL — opcje:
//   - "llama-3.3-70b-versatile"  → smart, ~1-3s per call (default)
//   - "llama-3.1-8b-instant"     → szybkie, ~200-500ms per call, slight quality drop
//   - "mixtral-8x7b-32768"       → balanced, ~500ms-1s
//   - "gemma2-9b-it"             → fast, ~300-700ms
const GROQ_MODEL = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

function getGroqClient(): Groq | null {
  const key = process.env.GROQ_API_KEY;
  if (!key) return null;
  return new Groq({ apiKey: key });
}

// Format zgodny z Groq/OpenAI chat completions. Tool messages mają osobny
// shape, assistant z tool_calls innym (content może być null gdy tool-call).
function toProviderMessages(messages: ChatMessageInput[]) {
  return messages.map((m) => {
    if (m.role === "tool") {
      return {
        role: "tool" as const,
        content: m.content,
        tool_call_id: m.toolCallId ?? "",
      };
    }
    if (m.role === "assistant" && m.toolCalls && m.toolCalls.length > 0) {
      return {
        role: "assistant" as const,
        content: m.content || null,
        tool_calls: m.toolCalls.map((c) => ({
          id: c.id,
          type: "function" as const,
          function: { name: c.name, arguments: c.arguments },
        })),
      };
    }
    return { role: m.role as "system" | "user" | "assistant", content: m.content };
  });
}

function toProviderTools(tools: ChatTool[]) {
  return tools.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}

// Retryable error types z Groq:
//   - 429 rate limit (most common)
//   - 503 service unavailable
//   - timeout / network reset
function isRetryableGroqError(e: unknown): { retryable: boolean; status?: number } {
  if (!e || typeof e !== "object") return { retryable: false };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const status = (e as any).status as number | undefined;
  if (status === 429 || status === 503 || status === 502 || status === 504) {
    return { retryable: true, status };
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const code = (e as any).code as string | undefined;
  if (code === "ETIMEDOUT" || code === "ECONNRESET" || code === "ECONNREFUSED") {
    return { retryable: true };
  }
  return { retryable: false, status };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function callGroq(
  messages: ChatMessageInput[],
  tools: ChatTool[],
  retryCount = 0,
): Promise<ChatResult | null> {
  const client = getGroqClient();
  if (!client) return null;

  const start = Date.now();
  let response;
  try {
    // groq-sdk types są generated z OpenAI spec — używamy any-cast tylko
    // do tool_calls bo SDK 1.2.1 ma węższy union niż realne API.
    response = await client.chat.completions.create({
      model: GROQ_MODEL,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      messages: toProviderMessages(messages) as any,
      tools: tools.length > 0 ? toProviderTools(tools) : undefined,
      temperature: 0.2,
      max_tokens: 1024,
    });
  } catch (e) {
    const { retryable, status } = isRetryableGroqError(e);
    if (retryable && retryCount < 2) {
      // Exponential backoff: 1.5s, 3s. Groq rate-limit window resetuje
      // się typowo w <60s; 2 retry zwykle wystarczy.
      const delay = 1500 * (retryCount + 1);
      console.warn(
        `[llm] Groq ${status ?? "network"} error — retry ${retryCount + 1}/2 za ${delay}ms`,
      );
      await sleep(delay);
      return callGroq(messages, tools, retryCount + 1);
    }
    // Non-retryable albo wyczerpane retry — propaguj z lepszym message'em.
    const errMsg = e instanceof Error ? e.message : String(e);
    throw new Error(`Groq ${status ?? "?"}: ${errMsg.slice(0, 200)}`);
  }

  const choice = response.choices[0];
  const rawToolCalls = choice.message.tool_calls ?? [];
  const toolCalls: ChatToolCall[] = rawToolCalls
    .filter((c) => c.type === "function")
    .map((c) => ({
      id: c.id,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      name: (c as any).function.name,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      arguments: (c as any).function.arguments,
    }));

  return {
    content: choice.message.content ?? "",
    toolCalls,
    tokensIn: response.usage?.prompt_tokens ?? 0,
    tokensOut: response.usage?.completion_tokens ?? 0,
    latencyMs: Date.now() - start,
    model: GROQ_MODEL,
    provider: "groq",
    finishReason: choice.finish_reason ?? "stop",
  };
}

async function callOpenAI(
  messages: ChatMessageInput[],
  tools: ChatTool[],
): Promise<ChatResult | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;

  const start = Date.now();
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: toProviderMessages(messages),
      tools: tools.length > 0 ? toProviderTools(tools) : undefined,
      temperature: 0.2,
      max_tokens: 1024,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI ${res.status}: ${text.slice(0, 300)}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (await res.json()) as any;
  const choice = data.choices[0];
  const rawToolCalls = choice.message.tool_calls ?? [];
  const toolCalls: ChatToolCall[] = rawToolCalls.map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (c: any) => ({
      id: c.id,
      name: c.function.name,
      arguments: c.function.arguments,
    }),
  );

  return {
    content: choice.message.content ?? "",
    toolCalls,
    tokensIn: data.usage?.prompt_tokens ?? 0,
    tokensOut: data.usage?.completion_tokens ?? 0,
    latencyMs: Date.now() - start,
    model: OPENAI_MODEL,
    provider: "openai",
    finishReason: choice.finish_reason ?? "stop",
  };
}

// Główny entry point. Próbuje Groq → OpenAI. Throw gdy oba zawiodą.
// Logika: Groq jest preferowany (cena), ale jeśli rate-limit / timeout /
// 5xx — przechodzimy do OpenAI bez user-facing erroru. Tylko gdy oba
// providery są niedostępne (no API keys lub oba failują) propagujemy błąd.
export async function chat(
  messages: ChatMessageInput[],
  tools: ChatTool[] = [],
): Promise<ChatResult> {
  let groqError: unknown = null;
  try {
    const groqResult = await callGroq(messages, tools);
    if (groqResult) return groqResult;
  } catch (e) {
    groqError = e;
    console.warn("[llm] Groq failed, trying OpenAI fallback:", e);
  }

  try {
    const openaiResult = await callOpenAI(messages, tools);
    if (openaiResult) return openaiResult;
  } catch (e) {
    console.error("[llm] OpenAI also failed:", e);
    throw new Error(
      `Wszystkie LLM providery są niedostępne. Groq: ${
        groqError instanceof Error ? groqError.message : "no-key"
      }. OpenAI: ${e instanceof Error ? e.message : "unknown"}`,
    );
  }

  throw new Error(
    "Brak skonfigurowanego LLM providera. Ustaw GROQ_API_KEY (rekomendowane) lub OPENAI_API_KEY w .env.",
  );
}
