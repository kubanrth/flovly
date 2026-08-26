// Self-check for the pure Lista helpers: `npx tsx components/table/list.check.ts`
import { nextSelection } from "./selection";
import assert from "node:assert/strict";
import { hueForColor } from "@/components/ui/status-hue";
import { groupTasks, sumNumberColumns } from "./grouping";
import { describeFilter, isActiveFilter } from "./filter-builder";
import type { BoardTableTask, CustomTableColumn } from "./types";

const task = (over: Partial<BoardTableTask>): BoardTableTask => ({
  id: "t", displayId: 1, title: "x", statusColumnId: null, priority: "NONE", startAt: null, stopAt: null,
  createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z", assignees: [], tags: [], customValues: {},
  attachments: [], milestone: null, hasDescription: false, commentCount: 0, subtaskCount: 0, subtaskDoneCount: 0, linkedCount: 0,
  ...over,
});
const budget: CustomTableColumn = { id: "b", name: "Budżet", type: "NUMBER", options: { numberFormat: "integer" } };

assert.equal(hueForColor("#F59E0B"), "yellow");
assert.equal(hueForColor("#64748B"), "gray");
assert.equal(hueForColor("nope"), "gray");

assert.equal(sumNumberColumns([task({ customValues: { b: "100" } }), task({ customValues: { b: "abc" } }), task({ customValues: { b: "250" } })], [budget])[0]!.text, "350");

const statuses = [{ id: "s1", name: "Do zrobienia", colorHex: "#64748B" }, { id: "s2", name: "Gotowe", colorHex: "#10B981" }];
const g = groupTasks(
  [task({ id: "a", statusColumnId: "s2", customValues: { b: "5" } }), task({ id: "b", statusColumnId: "s1" }), task({ id: "c", statusColumnId: null })],
  "statusColumnId",
  { statusColumns: statuses, customColumns: [budget] },
);
assert.deepEqual(g.map((x) => [x.key, x.label, x.hue, x.rows.length]), [["_empty", "Bez statusu", "gray", 1], ["s1", "Do zrobienia", "gray", 1], ["s2", "Gotowe", "green", 1]]);
assert.equal(g[2]!.sums[0]!.text, "5");
assert.equal(groupTasks([task({})], null, { statusColumns: [], customColumns: [] })[0]!.key, "_all");

const cols = [{ id: "statusColumnId", label: "Status", kind: "BUILTIN_STATUS" as const, options: [{ value: "s1", label: "W toku" }] }, { id: "title", label: "Tytuł", kind: "BUILTIN_TITLE" as const }];
assert.equal(describeFilter({ columnId: "statusColumnId", kind: "BUILTIN_STATUS", op: "equals", value: "s1" }, cols), "Status: W toku");
assert.equal(describeFilter({ columnId: "title", kind: "BUILTIN_TITLE", op: "contains", value: "ab" }, cols), "Tytuł zawiera „ab”");
assert.equal(describeFilter({ columnId: "title", kind: "BUILTIN_TITLE", op: "isEmpty", value: "" }, cols), "Tytuł: jest puste");
assert.equal(isActiveFilter({ columnId: "title", kind: "BUILTIN_TITLE", op: "contains", value: "" }), false);
assert.equal(isActiveFilter({ columnId: "title", kind: "BUILTIN_TITLE", op: "isEmpty", value: "" }), true);
// Shift-range: anchor + target inclusive; plain click toggles; unknown anchor falls back to a toggle.
assert.deepEqual(nextSelection({}, ["a", "b", "c", "d"], "d", "a", true), { a: true, b: true, c: true, d: true });
assert.deepEqual(nextSelection({}, ["a", "b", "c"], "b", null, true), { b: true });
assert.deepEqual(nextSelection({ b: true }, ["a", "b", "c"], "b", null, false), { b: false });
assert.deepEqual(nextSelection({}, ["a", "b"], "b", "gone", true), { b: true });

console.log("list helpers ok");
