// Rate limiting via Upstash Redis + sliding window.
//
// FAIL OPEN when Upstash env is absent or Redis is unreachable — rate
// limiting is a safety net, not an authz layer. A transient Redis outage
// must not lock everyone out.
//
// No `import "server-only"` so smoke tests can drive this via tsx. Real
// callers are Server Actions / server-only libs; Upstash client reads env
// vars absent in browser anyway.

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export type LimiterName =
  | "auth.login"
  // Dedicated limit dla recovery codes — bez tego user z 10 leaked codes
  // mógłby burn'ować wszystkie 10 prób bcrypt per request bez detekcji.
  | "auth.recoveryCode"
  | "comment.create"
  | "task.create"
  | "task.sendEmail"
  | "workspace.invite"
  // F12-K74: Ateron AI chat. Twardy limit zapytań żeby insider abuse nie
  // spalił klucza OpenAI w godziny. Per (userId + workspaceId).
  | "chat.message"
  // Drugi pasek (per day) — chroni przed slow drip exhaustion.
  | "chat.daily";

interface LimiterSpec {
  tokens: number;
  window: `${number} ${"s" | "m" | "h" | "d"}`;
  // Human-friendly description exposed to UI on rejection.
  friendly: string;
}

const SPECS: Record<LimiterName, LimiterSpec> = {
  // Login: per (IP + email) so bad actor can't brute one address while
  // not blocking unrelated users sharing an IP.
  "auth.login": { tokens: 5, window: "15 m", friendly: "5 prób na 15 minut" },
  // Tokens=3 < liczba codes (10) — user nie może na raz wszystkich testować.
  "auth.recoveryCode": { tokens: 3, window: "30 m", friendly: "3 próby na 30 minut" },
  "comment.create": { tokens: 30, window: "1 m", friendly: "30 komentarzy/min" },
  "task.create": { tokens: 30, window: "1 m", friendly: "30 zadań/min" },
  "task.sendEmail": { tokens: 10, window: "1 h", friendly: "10 wysyłek/godz" },
  "workspace.invite": {
    tokens: 20,
    window: "1 h",
    friendly: "20 zaproszeń/godz na przestrzeń",
  },
  // 20 wiadomości/min wystarczy dla legit usera (1 pytanie co 3s), spam'er
  // dostaje 429. Per (userId + workspaceId) — user z 5 workspace'ami
  // ma 5×20 = 100/min globalnie ale max 20 per workspace.
  "chat.message": {
    tokens: 20,
    window: "1 m",
    friendly: "20 wiadomości na minutę",
  },
  // 300/dzień to przy gpt-4o-mini ~$0.50/dzień max per user-workspace.
  // Dla 10-osobowego teamu = ~$150/mc górnego limitu cost.
  "chat.daily": {
    tokens: 300,
    window: "1 d",
    friendly: "300 wiadomości na dzień",
  },
};

const redisSingleton = (() => {
  let cached: Redis | null = null;
  let attempted = false;
  return () => {
    if (attempted) return cached;
    attempted = true;
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) return null;
    try {
      cached = new Redis({ url, token });
    } catch {
      cached = null;
    }
    return cached;
  };
})();

const limiters = new Map<LimiterName, Ratelimit>();

function getLimiter(name: LimiterName): Ratelimit | null {
  const existing = limiters.get(name);
  if (existing) return existing;
  const redis = redisSingleton();
  if (!redis) return null;
  const spec = SPECS[name];
  const rl = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(spec.tokens, spec.window),
    analytics: false,
    prefix: `ratelimit:${name}`,
  });
  limiters.set(name, rl);
  return rl;
}

export type LimitResult =
  | { ok: true; remaining: number }
  | { ok: false; error: string; resetMs: number };

// Returns ok=true when the request should proceed. If Upstash is unavailable
// we fail open (ok=true, remaining=-1 so callers can tell).
export async function checkLimit(
  name: LimiterName,
  key: string,
): Promise<LimitResult> {
  const rl = getLimiter(name);
  if (!rl) return { ok: true, remaining: -1 };
  try {
    const res = await rl.limit(key);
    if (res.success) return { ok: true, remaining: res.remaining };
    const resetMs = Math.max(0, res.reset - Date.now());
    return {
      ok: false,
      error: `Zbyt wiele prób — ${SPECS[name].friendly}.`,
      resetMs,
    };
  } catch (e) {
    // Log and fail open — outages shouldn't lock users out.
    console.warn(`[rate-limit] ${name} check failed:`, e instanceof Error ? e.message : e);
    return { ok: true, remaining: -1 };
  }
}
