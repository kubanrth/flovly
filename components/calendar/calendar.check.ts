// Self-check for the pure Kalendarz helpers: `npx tsx components/calendar/calendar.check.ts`
import assert from "node:assert/strict";
import {
  countTasksInMonth,
  dayKey,
  dayTitle,
  monthGrid,
  monthLocative,
  monthTitle,
  pillsByDay,
  shiftTaskDates,
  shortDate,
  splitDay,
  taskPills,
  type CalendarTask,
} from "./calendar-math";

const iso = (y: number, m: number, d: number, h = 9) => new Date(y, m - 1, d, h, 0).toISOString();
const task = (over: Partial<CalendarTask>): CalendarTask => ({
  id: "t", displayId: 1, title: "Zadanie", statusId: null, statusName: null, statusColor: null,
  startAt: null, stopAt: null, assignees: [], ...over,
});

// ─── grid: Monday first, whole weeks only ───────────────────────────────────
const sep = monthGrid(new Date(2026, 8, 1));
assert.equal(sep.length, 35); // 2026-09 spans exactly 5 Mon→Sun weeks
assert.equal(dayKey(sep[0]!), "2026-08-31");
assert.equal(dayKey(sep[34]!), "2026-10-04");
assert.equal(sep[0]!.getDay(), 1); // Monday

// Leap year: 2024-02 starts on a Thursday and has 29 days → 5 weeks, 29 Feb present.
const feb24 = monthGrid(new Date(2024, 1, 15));
assert.equal(feb24.length, 35);
assert.equal(dayKey(feb24[0]!), "2024-01-29");
assert.equal(dayKey(feb24[34]!), "2024-03-03");
assert.ok(feb24.some((d) => dayKey(d) === "2024-02-29"));

// Non-leap February starting on a Monday = exactly 4 weeks, no padding at all.
const feb21 = monthGrid(new Date(2021, 1, 1));
assert.equal(feb21.length, 28);
assert.equal(dayKey(feb21[0]!), "2021-02-01");
assert.equal(dayKey(feb21[27]!), "2021-02-28");

// Days are consecutive and unique across a DST switch (2026-03-29 in PL).
const mar = monthGrid(new Date(2026, 2, 1));
assert.equal(new Set(mar.map(dayKey)).size, mar.length);
assert.equal(dayKey(mar[mar.indexOf(mar.find((d) => dayKey(d) === "2026-03-28")!) + 1]!), "2026-03-29");

// ─── pills ──────────────────────────────────────────────────────────────────
const span = task({ id: "a", startAt: iso(2026, 9, 1), stopAt: iso(2026, 9, 12, 17) });
assert.deepEqual(taskPills(span).map((p) => [p.kind, p.label, p.day]), [
  ["start", "Zadanie — start", "2026-09-01"],
  ["end", "Zadanie — koniec", "2026-09-12"],
]);
assert.deepEqual(taskPills(task({ startAt: iso(2026, 9, 2), stopAt: iso(2026, 9, 2, 18) })).map((p) => p.kind), ["single"]);
assert.deepEqual(taskPills(task({ stopAt: iso(2026, 9, 4) })).map((p) => [p.kind, p.label]), [["single", "Zadanie"]]);
assert.deepEqual(taskPills(task({})), []);

const byDay = pillsByDay([span, task({ id: "b", displayId: 2, title: "Drugie", startAt: iso(2026, 9, 1, 8) })]);
assert.deepEqual(byDay.get("2026-09-01")!.map((p) => p.task.id), ["b", "a"]); // earlier time first
assert.equal(byDay.get("2026-09-12")!.length, 1);

assert.deepEqual(splitDay([1, 2, 3], 3), { visible: [1, 2, 3], overflow: 0 });
assert.deepEqual(splitDay([1, 2, 3, 4, 5], 3), { visible: [1, 2, 3], overflow: 2 });

assert.equal(countTasksInMonth([span, task({ id: "c", stopAt: iso(2026, 10, 3) })], new Date(2026, 8, 20)), 1);

// ─── drag = move the whole task, span preserved, leap day included ──────────
const leap = task({ startAt: iso(2024, 2, 28), stopAt: iso(2024, 3, 5, 17) });
const moved = shiftTaskDates(leap, "start", "2024-02-29")!;
assert.equal(dayKey(new Date(moved.startAt!)), "2024-02-29");
assert.equal(dayKey(new Date(moved.stopAt!)), "2024-03-06");
assert.equal(new Date(moved.startAt!).getHours(), 9); // wall-clock time kept
// Dragging the end pill moves the pair by the same delta.
const back = shiftTaskDates(leap, "end", "2024-03-03")!;
assert.equal(dayKey(new Date(back.startAt!)), "2024-02-26");
assert.equal(dayKey(new Date(back.stopAt!)), "2024-03-03");
// Month boundary on a deadline-only task: only stopAt is patched.
const boundary = shiftTaskDates(task({ stopAt: iso(2026, 1, 31, 17) }), "single", "2026-02-01")!;
assert.equal(boundary.startAt, undefined);
assert.equal(dayKey(new Date(boundary.stopAt!)), "2026-02-01");
// Same day = no patch; no dates = no patch.
assert.equal(shiftTaskDates(leap, "start", "2024-02-28"), null);
assert.equal(shiftTaskDates(task({}), "single", "2024-02-28"), null);

// ─── Polish formatting (labels the mockup spells out) ───────────────────────
assert.equal(monthTitle(new Date(2026, 8, 9)), "Wrzesień 2026");
assert.equal(shortDate(new Date(2026, 8, 9)), "9 wrz");
assert.equal(shortDate(new Date(2026, 9, 1)), "1 paź");
assert.equal(dayTitle(new Date(2026, 8, 9)), "Śr, 9 września");
assert.equal(monthLocative(new Date(2026, 8, 9)), "we wrześniu");

console.log("calendar helpers ok");
