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
// Fallback model — gdy primary hit TPD/RPM limit, próbujemy go.
// Domyślnie llama-3.1-8b-instant (osobny TPD counter, 5x szybszy).
// Ustaw "none" żeby wyłączyć fallback (tylko primary).
const GROQ_FALLBACK_MODEL =
  process.env.GROQ_FALLBACK_MODEL ?? "llama-3.1-8b-instant";
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

// Sprawdza czy 429 to TPD (tokens-per-day) limit (HARD, nie retryowalny do
// resetu o północy UTC) czy RPM/TPM (rate per minute/per second — retryowalne).
function isTpdLimit(errMsg: string): boolean {
  const lower = errMsg.toLowerCase();
  return (
    lower.includes("tokens per day") ||
    lower.includes("tpd") ||
    lower.includes("daily")
  );
}

async function callGroq(
  messages: ChatMessageInput[],
  tools: ChatTool[],
  // Pozwala wymusić konkretny model (używamy przy fallback'u na 8B gdy
  // primary 70B wyczerpał TPD).
  modelOverride?: string,
  retryCount = 0,
): Promise<ChatResult | null> {
  const client = getGroqClient();
  if (!client) return null;

  const model = modelOverride ?? GROQ_MODEL;
  const start = Date.now();
  let response;
  try {
    response = await client.chat.completions.create({
      model,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      messages: toProviderMessages(messages) as any,
      tools: tools.length > 0 ? toProviderTools(tools) : undefined,
      temperature: 0.2,
      // Mniej tokenów = mniejsze zużycie dziennego TPD limitu (free tier
      // 100k/dzień per model). Tool-call responses są zwykle krótkie.
      max_tokens: 768,
    });
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    const { retryable, status } = isRetryableGroqError(e);
    // TPD = hard limit, nie ma sensu retry'ować. Propaguj od razu z
    // czytelną flagą, żeby chat() mógł od razu spróbować fallback model.
    if (status === 429 && isTpdLimit(errMsg)) {
      console.warn(
        `[llm] Groq ${model} TPD limit reached — fallback nie pomoże retry'em`,
      );
      throw new Error(`Groq 429 TPD: ${errMsg.slice(0, 200)}`);
    }
    if (retryable && retryCount < 2) {
      const delay = 1500 * (retryCount + 1);
      console.warn(
        `[llm] Groq ${model} ${status ?? "network"} error — retry ${retryCount + 1}/2 za ${delay}ms`,
      );
      await sleep(delay);
      return callGroq(messages, tools, model, retryCount + 1);
    }
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
    model,
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

// Główny entry point. Cascading fallback:
//   1. Groq primary model (GROQ_MODEL, default llama-3.3-70b-versatile)
//   2. Groq fallback model (GROQ_FALLBACK_MODEL, default llama-3.1-8b-instant)
//      ← przydatne gdy primary wyczerpał TPD (osobny licznik per model)
//   3. OpenAI gpt-4o-mini (jeśli OPENAI_API_KEY ustawiony)
//
// Throw z czytelnym komunikatem gdy wszystkie zawiodą.
export async function chat(
  messages: ChatMessageInput[],
  tools: ChatTool[] = [],
): Promise<ChatResult> {
  const groqClient = getGroqClient();
  const hasOpenAi = !!process.env.OPENAI_API_KEY;

  let primaryGroqError: unknown = null;
  let fallbackGroqError: unknown = null;

  // 1. Groq primary
  if (groqClient) {
    try {
      const result = await callGroq(messages, tools);
      if (result) return result;
    } catch (e) {
      primaryGroqError = e;
      console.warn(
        `[llm] Groq primary (${GROQ_MODEL}) failed: ${e instanceof Error ? e.message : e}`,
      );
    }
  }

  // 2. Groq fallback (różny model = osobny TPD)
  if (
    groqClient &&
    GROQ_FALLBACK_MODEL !== "none" &&
    GROQ_FALLBACK_MODEL !== GROQ_MODEL
  ) {
    try {
      const result = await callGroq(messages, tools, GROQ_FALLBACK_MODEL);
      if (result) {
        console.log(
          `[llm] Groq fallback (${GROQ_FALLBACK_MODEL}) used — primary unavailable`,
        );
        return result;
      }
    } catch (e) {
      fallbackGroqError = e;
      console.warn(
        `[llm] Groq fallback (${GROQ_FALLBACK_MODEL}) failed: ${e instanceof Error ? e.message : e}`,
      );
    }
  }

  // 3. OpenAI
  if (hasOpenAi) {
    try {
      const result = await callOpenAI(messages, tools);
      if (result) {
        console.log("[llm] OpenAI fallback used");
        return result;
      }
    } catch (e) {
      console.error(`[llm] OpenAI failed: ${e instanceof Error ? e.message : e}`);
      throw new Error(
        `Wszystkie LLM providery padły. Groq: ${
          primaryGroqError instanceof Error ? primaryGroqError.message : "?"
        }. OpenAI: ${e instanceof Error ? e.message : "?"}`,
      );
    }
  }

  // Wszystko padło. Konkretny komunikat zależy od tego co próbowaliśmy.
  if (primaryGroqError) {
    const msg = primaryGroqError instanceof Error ? primaryGroqError.message : "?";
    const isTPD = msg.includes("429 TPD");
    if (isTPD) {
      throw new Error(
        `Wyczerpaliśmy dzienny limit AI (Groq TPD). ${
          fallbackGroqError ? "Model zapasowy też padł. " : ""
        }${
          hasOpenAi
            ? "OpenAI nie odpowiedział."
            : "Ustaw OPENAI_API_KEY w env vars jako fallback, albo poczekaj do północy UTC."
        }`,
      );
    }
    throw new Error(
      `Groq nieosiągalny: ${msg.slice(0, 150)}. ${
        hasOpenAi ? "OpenAI też padł." : "Ustaw OPENAI_API_KEY jako fallback."
      }`,
    );
  }

  throw new Error(
    "Brak skonfigurowanego LLM providera. Ustaw GROQ_API_KEY (rekomendowane) lub OPENAI_API_KEY w .env.",
  );
}
