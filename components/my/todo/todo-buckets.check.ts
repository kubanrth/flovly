// Self-check for the pure TO DO helpers: `npx tsx components/my/todo/todo-buckets.check.ts`
import assert from "node:assert/strict";
import { bucketItems, completedToday, dayCounter, dueLabel, itemSection, type TodoBucketable } from "./todo-buckets";

const now = new Date(2026, 7, 26, 12, 0, 0); // środa
const at = (y: number, m: number, d: number, h = 0, min = 0, s = 0, ms = 0) =>
  new Date(y, m, d, h, min, s, ms).toISOString();
const item = (over: Partial<TodoBucketable> = {}): TodoBucketable => ({
  completed: false, dueDate: null, updatedAt: at(2026, 7, 26, 9), ...over,
});

// Granica północy: zadanie na dziś 23:59 to „Dzisiaj”, jutro 00:00 to „Ten tydzień”.
assert.equal(itemSection(item({ dueDate: at(2026, 7, 26, 23, 59, 59, 999) }), now), "today");
assert.equal(itemSection(item({ dueDate: at(2026, 7, 27, 0, 0, 0, 0) }), now), "week");
// Po terminie i bez terminu też lądują w „Dzisiaj”.
assert.equal(itemSection(item({ dueDate: at(2026, 7, 20) }), now), "today");
assert.equal(itemSection(item(), now), "today");
assert.equal(itemSection(item({ dueDate: at(2026, 7, 30, 23, 59) }), now), "week");
assert.equal(itemSection(item({ dueDate: at(2026, 7, 31) }), now), "later");

// „Ukończone dziś” liczone od północy — 23:59:59.999 wczoraj to już „wcześniej”.
assert.equal(completedToday(item({ completed: true, updatedAt: at(2026, 7, 26, 0, 0, 0, 0) }), now), true);
assert.equal(completedToday(item({ completed: true, updatedAt: at(2026, 7, 25, 23, 59, 59, 999) }), now), false);
assert.equal(completedToday(item({ completed: false, updatedAt: at(2026, 7, 26, 10) }), now), false);

const items = [
  item({ completed: true, updatedAt: at(2026, 7, 26, 8) }),
  item({ completed: true, updatedAt: at(2026, 7, 26, 9) }),
  item({ completed: true, updatedAt: at(2026, 7, 26, 10) }),
  item({ dueDate: at(2026, 7, 26, 10) }),
  item(),
  item({ dueDate: at(2026, 7, 28) }),
  item({ dueDate: at(2026, 7, 28) }),
  item({ dueDate: at(2026, 7, 29) }),
  item({ dueDate: at(2026, 8, 20) }),
  item({ completed: true, updatedAt: at(2026, 7, 10) }),
];
const b = bucketItems(items, now);
assert.deepEqual([b.today.length, b.week.length, b.later.length, b.earlier.length], [5, 3, 1, 1]);
// Makietowy licznik: 3 ukończone dziś z 9 widocznych pozycji.
assert.deepEqual(dayCounter(b, now), { done: 3, total: 9 });

assert.equal(dueLabel(at(2026, 7, 26, 10), now), "dziś");
assert.equal(dueLabel(at(2026, 7, 25), now), "po terminie");
assert.equal(dueLabel(at(2026, 7, 28), now), "pt"); // 28 sie 2026 = piątek
assert.equal(dueLabel(at(2026, 8, 20), now), "20 wrz");

console.log("todo buckets ok");
