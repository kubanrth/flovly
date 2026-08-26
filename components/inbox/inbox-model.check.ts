// Self-check for the pure D1 helpers: `npx tsx components/inbox/inbox-model.check.ts`
import assert from "node:assert/strict";
import { dayBucket, dueLabel, filterByTab, groupByBucket, shiftDay, whenLabel } from "./inbox-model";

// Midnight boundary: buckets follow calendar days, not 24 h windows.
const justAfterMidnight = "2026-08-26T00:30:00+02:00";
assert.equal(dayBucket("2026-08-25T23:50:00+02:00", justAfterMidnight), "yesterday"); // 40 min ago, still „Wczoraj”
assert.equal(dayBucket("2026-08-26T00:10:00+02:00", justAfterMidnight), "today");
assert.equal(dayBucket("2026-08-24T23:59:00+02:00", justAfterMidnight), "earlier");
// …and the reverse trap: 23 h ago but the same calendar day.
assert.equal(dayBucket("2026-08-26T00:10:00+02:00", "2026-08-26T23:50:00+02:00"), "today");
// Clock skew / future timestamps land in „Dzisiaj” instead of falling out of the feed.
assert.equal(dayBucket("2026-08-27T09:00:00+02:00", justAfterMidnight), "today");

assert.equal(shiftDay("2026-03-01", -1), "2026-02-28");
assert.equal(shiftDay("2026-01-01", -1), "2025-12-31");

const now = "2026-08-26T10:00:00+02:00";
assert.equal(whenLabel("2026-08-26T11:42:00+02:00", now), "11:42");
assert.equal(whenLabel("2026-08-25T15:22:00+02:00", now), "wczoraj 15:22");
assert.equal(whenLabel("2026-08-20T09:00:00+02:00", now), "20 sie 09:00");
assert.equal(dueLabel("2026-08-25T17:00:00+02:00", now), "wczoraj (25 sie)");
assert.equal(dueLabel("2026-08-26T17:00:00+02:00", now), "dziś 17:00");

const items = [
  { type: "comment.mention", unread: true },
  { type: "task.assigned", unread: false },
  { type: "support.assigned", unread: true },
  { type: "task.status.changed", unread: false },
];
assert.equal(filterByTab(items, "unread").length, 2);
assert.deepEqual(filterByTab(items, "mentions").map((i) => i.type), ["comment.mention"]);
assert.deepEqual(filterByTab(items, "assignments").map((i) => i.type), ["task.assigned", "support.assigned"]);
assert.equal(filterByTab(items, "all").length, 4);

assert.deepEqual(
  groupByBucket([
    { id: "a", bucket: "earlier" as const },
    { id: "b", bucket: "today" as const },
    { id: "c", bucket: "earlier" as const },
  ]).map((g) => [g.key, g.label, g.items.length]),
  [
    ["today", "Dzisiaj", 1],
    ["earlier", "Wcześniej", 2],
  ],
);

console.log("inbox helpers ok");
