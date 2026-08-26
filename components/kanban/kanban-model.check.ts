// Self-check for the pure Kanban helpers: `npx tsx components/kanban/kanban-model.check.ts`
import assert from "node:assert/strict";
import {
  NO_STATUS, buildSwimlanes, columnBuckets, filterTasks, isOverdue, lanePl, matchesQuery, sortTasks, visibleColumnIds, wipTone,
  type KanbanMember, type KanbanTask,
} from "./kanban-model";

const member = (id: string, name: string): KanbanMember => ({ id, name, email: `${id}@x.pl`, avatarUrl: null });
const task = (over: Partial<KanbanTask>): KanbanTask => ({
  id: "t", displayId: 1, title: "x", statusColumnId: null, rowOrder: 0, priority: "NONE", startAt: null, stopAt: null,
  assignees: [], tags: [], hasDescription: false, commentCount: 0, subtaskCount: 0, subtaskDoneCount: 0, linkedCount: 0, attachmentCount: 0,
  ...over,
});
const cols = [{ id: "s1", name: "Do zrobienia", colorHex: "#64748B" }, { id: "s2", name: "W toku", colorHex: "#0A84FF" }];

// buckets: per column, rowOrder-sorted, unstatused tasks in NO_STATUS
const b = columnBuckets(
  [task({ id: "a", statusColumnId: "s1", rowOrder: 2 }), task({ id: "b", statusColumnId: "s1", rowOrder: 1 }), task({ id: "c" })],
  cols,
);
assert.deepEqual(b.get("s1")!.map((t) => t.id), ["b", "a"]);
assert.deepEqual(b.get("s2")!.map((t) => t.id), []);
assert.deepEqual(b.get(NO_STATUS)!.map((t) => t.id), ["c"]);
assert.deepEqual(visibleColumnIds(cols, b), ["s1", "s2", NO_STATUS]);
assert.deepEqual(visibleColumnIds(cols, columnBuckets([task({ id: "a", statusColumnId: "s1" })], cols)), ["s1", "s2"]);

// WIP: no chip without a limit, yellow at/below, red over
assert.equal(wipTone(4, null), null);
assert.equal(wipTone(4, 0), null);
assert.equal(wipTone(4, 5), "yellow");
assert.equal(wipTone(5, 5), "yellow");
assert.equal(wipTone(6, 5), "red");

// overdue: yesterday yes, today no, tomorrow no, none no
const now = new Date(2026, 7, 26, 10, 0, 0);
assert.equal(isOverdue(new Date(2026, 7, 25, 23, 0, 0).toISOString(), now), true);
assert.equal(isOverdue(new Date(2026, 7, 26, 6, 0, 0).toISOString(), now), false);
assert.equal(isOverdue(new Date(2026, 7, 27, 6, 0, 0).toISOString(), now), false);
assert.equal(isOverdue(null, now), false);

// search: title substring + #id
assert.equal(matchesQuery(task({ title: "Integracja BLIK", displayId: 251 }), "blik"), true);
assert.equal(matchesQuery(task({ title: "Integracja BLIK", displayId: 251 }), "#25"), true);
assert.equal(matchesQuery(task({ title: "Integracja BLIK", displayId: 251 }), "251"), true);
assert.equal(matchesQuery(task({ title: "Integracja BLIK", displayId: 251 }), "xyz"), false);

const kuba = member("u1", "Kuba"), dan = member("u2", "Daniel");
const rows = [
  task({ id: "a", statusColumnId: "s1", assignees: [dan], priority: "HIGH" }),
  task({ id: "b", statusColumnId: "s2", assignees: [dan, kuba] }),
  task({ id: "c", statusColumnId: "s1" }),
];
assert.deepEqual(filterTasks(rows, { query: "", people: ["u1"], priority: null }).map((t) => t.id), ["b"]);
assert.deepEqual(filterTasks(rows, { query: "", people: [], priority: "HIGH" }).map((t) => t.id), ["a"]);
assert.deepEqual(filterTasks(rows, { query: "", people: [], priority: null }).length, 3);

// swimlanes: a lane per assignee (shared task counts in both) + „Nieprzypisane” last
const lanes = buildSwimlanes(rows, ["s1", "s2"], "assignee", [dan, kuba]);
assert.deepEqual(lanes.map((l) => [l.label, l.count]), [["Daniel", 2], ["Kuba", 1], ["Nieprzypisane", 1]]);
assert.deepEqual(lanes[0]!.cells.s1!.map((t) => t.id), ["a"]);
assert.deepEqual(lanes[0]!.cells.s2!.map((t) => t.id), ["b"]);
assert.deepEqual(lanes[2]!.cells.s1!.map((t) => t.id), ["c"]);
assert.equal(lanes[0]!.avatar!.name, "Daniel");
// priority lanes keep the P0→brak order and drop empty ones
assert.deepEqual(buildSwimlanes(rows, ["s1", "s2"], "priority", []).map((l) => l.label), ["P1 Wysoki", "Bez priorytetu"]);

// sorting
const s = [task({ id: "a", rowOrder: 3, priority: "LOW", stopAt: "2026-09-01", title: "B" }), task({ id: "b", rowOrder: 1, priority: "URGENT", title: "A" })];
assert.deepEqual(sortTasks(s, "manual").map((t) => t.id), ["b", "a"]);
assert.deepEqual(sortTasks(s, "priority").map((t) => t.id), ["b", "a"]);
assert.deepEqual(sortTasks(s, "stopAt").map((t) => t.id), ["a", "b"]);
assert.deepEqual(sortTasks(s, "title").map((t) => t.id), ["b", "a"]);

assert.deepEqual([1, 3, 5].map(lanePl), ["tor", "tory", "torów"]);

console.log("kanban helpers ok");
