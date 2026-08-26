// Self-check for the workspace overview helpers: `npx tsx components/workspace/overview-model.check.ts`
import assert from "node:assert/strict";
import {
  activityStamp,
  boardStats,
  isSaved,
  overviewFooter,
  progressTone,
  toggleSaved,
  workspaceMeta,
  type SavedItem,
} from "./overview-model";

const cols = [
  { id: "s1", name: "Do zrobienia", order: 0 },
  { id: "s2", name: "W toku", order: 1 },
  { id: "s3", name: "Gotowe", order: 2 },
];
const now = new Date("2026-08-26T10:00:00Z");
const stats = boardStats(
  [
    { statusColumnId: "s3", stopAt: "2026-01-01T00:00:00Z" }, // done, past due → not overdue
    { statusColumnId: "s1", stopAt: "2026-08-25T00:00:00Z" }, // overdue
    { statusColumnId: "s2", stopAt: "2026-09-01T00:00:00Z" },
    { statusColumnId: null, stopAt: null },
  ],
  cols,
  now,
);
assert.deepEqual(stats, { done: 1, total: 4, open: 3, overdue: 1, share: 0.25, nextDue: "2026-09-01T00:00:00Z" });
assert.deepEqual(boardStats([], cols, now), { done: 0, total: 0, open: 0, overdue: 0, share: 0, nextDue: null });

// Mockup C1 progress colours.
assert.equal(progressTone(8 / 20), "success");
assert.equal(progressTone(25 / 34), "success");
assert.equal(progressTone(2 / 13), "info");

assert.equal(workspaceMeta(3, 7, new Date(2026, 4, 12)), "3 tablice · 7 osób · utworzona 12 maja 2026");
assert.equal(workspaceMeta(1, 1, new Date(2026, 0, 1)), "1 tablica · 1 osoba · utworzona 1 stycznia 2026");
assert.equal(overviewFooter(3, 67, 35), "3 tablice · 67 zadań łącznie · 35 otwartych");
assert.equal(overviewFooter(0, 0, 0), "0 tablic · 0 zadań łącznie · 0 otwartych");

// Stamps: today = time only, older days keep the day label.
const today = new Date(2026, 7, 26, 16, 40);
const yesterday = new Date(2026, 7, 25, 16, 40);
assert.equal(activityStamp(today, today), "16:40");
assert.equal(activityStamp(yesterday, today), "wczoraj 16:40");

// Starred: toggle on puts the item first, toggle off removes it, other types survive.
const board: SavedItem = { type: "board", id: "b1", label: "P&R", href: "/w/w1/b/b1/table" };
const task: SavedItem = { type: "task", id: "b1", label: "#1", href: "/w/w1/t/b1" };
const on = toggleSaved([task], board);
assert.deepEqual(on, [board, task]);
assert.equal(isSaved(on, board), true);
assert.deepEqual(toggleSaved(on, board), [task]);

console.log("workspace overview helpers ok");
