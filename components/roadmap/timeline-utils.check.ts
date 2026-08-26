// Self-check for the pure Oś czasu (B5) maths: `npx tsx components/roadmap/timeline-utils.check.ts`
import assert from "node:assert/strict";
import {
  DAY_MS,
  buildGanttScale,
  formatGanttRange,
  ganttColumnWidth,
  ganttDaysFromPx,
  ganttTs,
  ganttX,
  shiftIsoDays,
} from "./timeline-utils";

// ── column width per zoom ────────────────────────────────────────────────────
assert.equal(ganttColumnWidth("weeks"), 56); // 7 d × 8 px — the B5 mockup grid
assert.equal(ganttColumnWidth("months"), 90);
assert.equal(ganttColumnWidth("quarters"), 91);

// ── drag inverse: +2 columns in the weeks zoom = +14 days (AK100) ────────────
assert.equal(ganttDaysFromPx(2 * ganttColumnWidth("weeks"), "weeks"), 14);
assert.equal(ganttDaysFromPx(-56, "weeks"), -7);
assert.equal(ganttDaysFromPx(3, "weeks"), 0); // sub-day jitter never moves a date
assert.equal(ganttDaysFromPx(90, "months"), 30);
assert.equal(shiftIsoDays("2026-08-04T00:00:00.000Z", 14), "2026-08-18T00:00:00.000Z");

// ── scale: origin snaps to the Monday before, today line sits on today ───────
const local = (y: number, m: number, d: number) => new Date(y, m - 1, d).getTime();
const iso = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12).toISOString();
const now = local(2026, 8, 26); // Wed 26 Aug 2026
const scale = buildGanttScale([{ startAt: iso(2026, 8, 4), stopAt: iso(2026, 9, 25) }], now, "weeks");

const origin = new Date(scale.originTs);
assert.equal(origin.getDay(), 1, "origin is a Monday");
assert.equal(origin.getHours(), 0);
// 4 Aug 2026 is a Tuesday → its week starts Mon 3 Aug → one week of lead-in = Mon 27 Jul.
assert.equal(origin.toDateString(), new Date(2026, 6, 27).toDateString());
assert.equal(scale.pxPerDay, 8);

// date → x
assert.equal(Math.round(ganttX(scale, local(2026, 7, 27))), 0);
assert.equal(Math.round(ganttX(scale, local(2026, 8, 3))), 56); // one week in
// x → date (inverse)
assert.equal(new Date(ganttTs(scale, 56)).toDateString(), new Date(2026, 7, 3).toDateString());
assert.equal(Math.round(ganttX(scale, ganttTs(scale, 168))), 168);

// today line: 30 days after the origin × 8 px
assert.equal(scale.todayX, ((local(2026, 8, 26) - scale.originTs) / DAY_MS) * 8);
assert.equal(scale.todayX, 240);

// grid + headers
assert.equal(scale.columns[0]!.w, 56);
assert.equal(scale.width, scale.columns.reduce((a, c) => a + c.w, 0));
assert.deepEqual(scale.headers.map((h) => h.label), ["lipiec", "sierpień", "wrzesień", "październik"]);
assert.equal(scale.headers[0]!.x, 0);
assert.equal(Math.round(scale.headers.at(-1)!.x + scale.headers.at(-1)!.w), Math.round(scale.width));

// zoom swaps the header bands (AK101) without moving the range
assert.deepEqual(buildGanttScale([{ startAt: iso(2026, 8, 4), stopAt: iso(2026, 9, 25) }], now, "months").headers.map((h) => h.label), ["III kw. 2026", "IV kw. 2026"]);
assert.deepEqual(buildGanttScale([{ startAt: iso(2026, 8, 4), stopAt: iso(2026, 9, 25) }], now, "quarters").headers.map((h) => h.label), ["2026", "2027"]);

// fitWidth (mobile, 420 px) compresses the same range into a fixed width
const fit = buildGanttScale([{ startAt: iso(2026, 8, 4), stopAt: iso(2026, 9, 25) }], now, "weeks", 420);
assert.equal(Math.round(fit.width), 420);
assert.equal(fit.originTs, scale.originTs);

// empty board still yields a usable axis around today
const empty = buildGanttScale([], now, "weeks");
assert.ok(empty.width > 0 && empty.todayX !== null);

assert.equal(formatGanttRange(iso(2026, 8, 4), iso(2026, 9, 25)), "4 sie – 25 wrz");

console.log("timeline (gantt) helpers ok");
