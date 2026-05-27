// Timing-safe Bearer token comparison dla cron endpoint'ów —
// defense-in-depth vs string equality early-exit.

import { timingSafeEqual } from "node:crypto";

export function isCronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  // timingSafeEqual throws on length mismatch.
  if (auth.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(auth), Buffer.from(expected));
  } catch {
    return false;
  }
}
