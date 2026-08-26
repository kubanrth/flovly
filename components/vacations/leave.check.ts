// Self-check for the pure Urlopy helpers: `npx tsx components/vacations/leave.check.ts`
import assert from "node:assert/strict";
import { ANNUAL_LEAVE_DAYS, coversDay, monthSpan, overlaps, remainingDays, usedDays, workingDays } from "./leave";

const r = (startDate: string, endDate: string) => ({ startDate, endDate });

// ── overlaps ──────────────────────────────────────────────────────────────
// Touching but NOT overlapping: 1–5 wrz ends the day before 6 wrz starts.
assert.equal(overlaps(r("2026-09-01", "2026-09-05"), r("2026-09-06", "2026-09-10")), false);
assert.equal(overlaps(r("2026-09-06", "2026-09-10"), r("2026-09-01", "2026-09-05")), false);
// Sharing a single endpoint IS an overlap.
assert.equal(overlaps(r("2026-09-01", "2026-09-05"), r("2026-09-05", "2026-09-09")), true);
// Containment either way.
assert.equal(overlaps(r("2026-09-01", "2026-09-30"), r("2026-09-10", "2026-09-12")), true);
assert.equal(overlaps(r("2026-09-10", "2026-09-12"), r("2026-09-01", "2026-09-30")), true);
// Single-day leave: overlaps itself, and not the neighbouring days.
const oneDay = r("2026-09-10", "2026-09-10");
assert.equal(overlaps(oneDay, oneDay), true);
assert.equal(overlaps(oneDay, r("2026-09-11", "2026-09-11")), false);
assert.equal(overlaps(oneDay, r("2026-09-09", "2026-09-09")), false);
assert.equal(overlaps(oneDay, r("2026-09-09", "2026-09-10")), true);
// ISO timestamps (Prisma serialises DateTime with a time part) behave like plain dates.
assert.equal(overlaps(r("2026-09-10T00:00:00.000Z", "2026-09-10T00:00:00.000Z"), oneDay), true);

// ── workingDays ───────────────────────────────────────────────────────────
assert.equal(workingDays(r("2026-09-22", "2026-09-26")), 4); // wt–sb → 4 dni robocze
assert.equal(workingDays(r("2026-09-01", "2026-09-01")), 1); // wtorek, jeden dzień
assert.equal(workingDays(r("2026-09-05", "2026-09-05")), 0); // sobota
assert.equal(workingDays(r("2026-09-05", "2026-09-06")), 0); // cały weekend
assert.equal(workingDays(r("2026-09-10", "2026-09-01")), 0); // odwrócony zakres

// ── limit ─────────────────────────────────────────────────────────────────
assert.equal(usedDays([r("2026-09-01", "2026-09-01"), r("2026-09-22", "2026-09-26")]), 5);
assert.equal(remainingDays(5), ANNUAL_LEAVE_DAYS - 5);
assert.equal(remainingDays(99), 0); // nigdy ujemny

// ── monthSpan ─────────────────────────────────────────────────────────────
assert.deepEqual(monthSpan(r("2026-09-22", "2026-09-26"), 2026, 8), { startDay: 22, endDay: 26 });
assert.deepEqual(monthSpan(r("2026-08-28", "2026-09-03"), 2026, 8), { startDay: 1, endDay: 3 });
assert.deepEqual(monthSpan(r("2026-09-28", "2026-10-04"), 2026, 8), { startDay: 28, endDay: 30 });
assert.equal(monthSpan(r("2026-08-01", "2026-08-31"), 2026, 8), null);
assert.equal(monthSpan(r("2026-10-01", "2026-10-05"), 2026, 8), null);

// ── coversDay ─────────────────────────────────────────────────────────────
assert.equal(coversDay(r("2026-09-22", "2026-09-26"), "2026-09-22"), true);
assert.equal(coversDay(r("2026-09-22", "2026-09-26"), "2026-09-26"), true);
assert.equal(coversDay(r("2026-09-22", "2026-09-26"), "2026-09-27"), false);

console.log("leave.check.ts OK");
