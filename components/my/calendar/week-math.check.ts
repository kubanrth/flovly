// Self-check for the personal calendar week maths:
// `npx tsx components/my/calendar/week-math.check.ts`
import assert from "node:assert/strict";
import { dayKey } from "@/components/calendar/calendar-math";
import {
  GRID_PX,
  HOUR_LABELS,
  addDays,
  hourOffset,
  isoWeek,
  layoutWeek,
  nowOffset,
  rangeLabel,
  startOfWeek,
  timeLabel,
  weekDays,
  type WeekItem,
} from "./week-math";

const at = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min).toISOString();
const item = (over: Partial<WeekItem> & { key: string }): WeekItem => ({
  source: "tasks", title: "Zadanie", startAt: null, stopAt: null, href: null, ...over,
});

// ─── week generation: Monday first, local midnight ──────────────────────────
const week = weekDays(new Date(2026, 7, 26, 14, 38)); // Wt 26 sierpnia 2026
assert.equal(week.length, 7);
assert.equal(dayKey(week[0]!), "2026-08-24");
assert.equal(dayKey(week[6]!), "2026-08-30");
assert.equal(week[0]!.getDay(), 1); // poniedziałek
assert.ok(week.every((d) => d.getHours() === 0 && d.getMinutes() === 0));
// Monday stays put; Sunday belongs to the week that started six days earlier.
assert.equal(dayKey(startOfWeek(new Date(2026, 7, 24))), "2026-08-24");
assert.equal(dayKey(startOfWeek(new Date(2026, 7, 30, 23, 59))), "2026-08-24");

// DST week (PL spring-forward 2026-03-29): still 7 distinct local midnights.
const dst = weekDays(new Date(2026, 2, 25));
assert.equal(dayKey(dst[0]!), "2026-03-23");
assert.equal(dayKey(dst[6]!), "2026-03-29");
assert.equal(new Set(dst.map(dayKey)).size, 7);
assert.ok(dst.every((d) => d.getHours() === 0));
// Autumn switch (2026-10-25) — the extra hour must not duplicate a day either.
const dstBack = weekDays(new Date(2026, 9, 21));
assert.equal(dayKey(dstBack[6]!), "2026-10-25");
assert.equal(new Set(dstBack.map(dayKey)).size, 7);

// Month + year boundaries in the week itself.
assert.equal(dayKey(addDays(new Date(2026, 7, 31), 1)), "2026-09-01");
assert.equal(dayKey(weekDays(new Date(2026, 8, 1))[0]!), "2026-08-31");

// ─── header labels ──────────────────────────────────────────────────────────
assert.equal(rangeLabel(weekDays(new Date(2026, 7, 26))), "24 – 30 sierpnia 2026");
// Month boundary: both months spelled out.
assert.equal(rangeLabel(weekDays(new Date(2026, 8, 1))), "31 sierpnia – 6 września 2026");
// Year boundary: both years spelled out.
assert.equal(rangeLabel(weekDays(new Date(2026, 11, 31))), "28 grudnia 2026 – 3 stycznia 2027");
assert.equal(rangeLabel([new Date(2026, 7, 26)]), "Środa, 26 sierpnia 2026");

assert.equal(isoWeek(new Date(2026, 7, 26)), 35); // mockup: „tydzień 35"
assert.equal(isoWeek(new Date(2026, 0, 1)), 1);
assert.equal(isoWeek(new Date(2025, 11, 29)), 1); // ISO week 1 of 2026 starts in December
assert.equal(isoWeek(new Date(2026, 11, 31)), 53);

// ─── hour positioning ───────────────────────────────────────────────────────
assert.deepEqual([HOUR_LABELS[0], HOUR_LABELS.at(-1), HOUR_LABELS.length], ["08:00", "17:00", 10]);
assert.equal(hourOffset(new Date(2026, 7, 26, 8, 0)), 0);
assert.equal(hourOffset(new Date(2026, 7, 26, 9, 0)), 48);
assert.equal(hourOffset(new Date(2026, 7, 26, 14, 0)), 288);
assert.equal(hourOffset(new Date(2026, 7, 26, 14, 38)), 318.4); // mockup „teraz" line
assert.equal(hourOffset(new Date(2026, 7, 26, 6, 0)), 0); // before the window → first row
assert.equal(hourOffset(new Date(2026, 7, 26, 23, 59)), GRID_PX); // after → last row
assert.equal(timeLabel(new Date(2026, 7, 26, 9, 5)), "09:05");

const today = new Date(2026, 7, 26, 14, 38);
assert.equal(nowOffset(today, new Date(2026, 7, 26)), 318.4);
assert.equal(nowOffset(today, new Date(2026, 7, 27)), null); // inny dzień
assert.equal(nowOffset(new Date(2026, 7, 26, 6, 0), new Date(2026, 7, 26)), null); // poza oknem

// ─── bucketing: all-day vs timed ────────────────────────────────────────────
const layout = layoutWeek(
  [
    item({ key: "v1", source: "vacations", title: "Urlop: Gabryś", startAt: at(2026, 8, 27), stopAt: at(2026, 8, 28) }),
    item({ key: "t1", title: "Termin: #253 Puste stany", stopAt: at(2026, 8, 26, 14, 0), href: "/w/x/t/253" }),
    item({ key: "r1", source: "reminders", title: "Przypomnienie: deploy", stopAt: at(2026, 8, 26, 9, 0) }),
    item({ key: "t2", title: "Poza tygodniem", stopAt: at(2026, 9, 10, 12, 0) }),
    item({ key: "t3", title: "Bez daty" }),
  ],
  weekDays(new Date(2026, 7, 26)),
);
assert.deepEqual(layout.counts, { tasks: 1, reminders: 1, vacations: 1 });
assert.deepEqual(layout.allDay.get("2026-08-27")!.map((b) => b.label), ["Urlop: Gabryś (27–28)"]);
assert.deepEqual(layout.allDay.get("2026-08-28")!.map((b) => b.label), ["Urlop: Gabryś"]);
assert.equal(layout.allDay.get("2026-08-26"), undefined);
assert.equal(layout.timed.get("2026-09-10"), undefined); // spoza tygodnia
assert.deepEqual(
  layout.timed.get("2026-08-26")!.map((b) => [b.key, b.timeLabel, b.top]),
  [["r1", "09:00", 48], ["t1", "14:00", 288]],
);

// Single-day vacation gets no range suffix.
const oneDay = layoutWeek(
  [item({ key: "v2", source: "vacations", title: "Twój urlop", startAt: at(2026, 8, 25), stopAt: at(2026, 8, 25) })],
  weekDays(new Date(2026, 7, 26)),
);
assert.deepEqual(oneDay.allDay.get("2026-08-25")!.map((b) => b.label), ["Twój urlop"]);

// Overlapping pills slide down instead of hiding each other; nothing leaves the grid.
const clash = layoutWeek(
  [
    item({ key: "a", stopAt: at(2026, 8, 26, 9, 0) }),
    item({ key: "b", source: "reminders", stopAt: at(2026, 8, 26, 9, 10) }),
    item({ key: "c", stopAt: at(2026, 8, 26, 23, 59) }),
  ],
  weekDays(new Date(2026, 7, 26)),
);
const tops = clash.timed.get("2026-08-26")!.map((b) => b.top);
assert.deepEqual(tops, [48, 72, GRID_PX - 20]);
assert.ok(tops.every((t, i) => i === 0 || t >= tops[i - 1]! + 20));

// Month-boundary week: Monday and Sunday sit in different months, both filled.
const boundary = layoutWeek(
  [
    item({ key: "m1", stopAt: at(2026, 8, 31, 10, 0) }),
    item({ key: "m2", stopAt: at(2026, 9, 6, 16, 0) }),
    item({ key: "m3", source: "vacations", title: "Urlop: Ola", startAt: at(2026, 8, 30), stopAt: at(2026, 9, 2) }),
  ],
  weekDays(new Date(2026, 8, 2)),
);
assert.deepEqual(boundary.timed.get("2026-08-31")!.map((b) => b.top), [96]);
assert.deepEqual(boundary.timed.get("2026-09-06")!.map((b) => b.timeLabel), ["16:00"]);
// Span starts before the week → suffix lands on the first visible day (Mon 31.08).
assert.deepEqual(
  ["2026-08-31", "2026-09-01", "2026-09-02"].map((k) => boundary.allDay.get(k)!.map((b) => b.label)),
  [["Urlop: Ola (30–2)"], ["Urlop: Ola"], ["Urlop: Ola"]],
);
assert.equal(boundary.allDay.get("2026-09-03"), undefined);

console.log("week-math ok");
