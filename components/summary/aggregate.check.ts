// Self-check for the Podsumowanie aggregation: `npx tsx components/summary/aggregate.check.ts`
import assert from "node:assert/strict";
import { activityPhrase, activityTime, makeIsDone, summarize, type SummaryStatus, type SummaryTask } from "./aggregate";

const statuses: SummaryStatus[] = [
  { id: "s1", name: "Do zrobienia", colorHex: "#8A857D", order: 0 },
  { id: "s2", name: "W toku", colorHex: "#2F6FE8", order: 1 },
  { id: "s3", name: "Do poprawy", colorHex: "#E8A100", order: 2 },
  { id: "s4", name: "Gotowe", colorHex: "#1E9E5A", order: 3 },
];
const task = (over: Partial<SummaryTask>): SummaryTask => ({
  id: "t", displayId: 0, statusColumnId: null, stopAt: null, assigneeIds: [], ...over,
});

// Done detection: a named done column wins outright, so a column appended after
// „Gotowe” neither steals the meaning nor counts as done itself. Positional
// fallback only applies to boards with no named done column — see
// components/board/done-status.check.ts.
const appended = [...statuses, { id: "s5", name: "FAZA-2030", colorHex: "#8A857D", order: 4 }];
const isDone = makeIsDone(appended);
assert.equal(isDone("s4"), true);
assert.equal(isDone("s5"), false, "a trailing non-done column must not count as done");
assert.equal(isDone("s2"), false);
assert.equal(isDone(null), false);
assert.equal(isDone("nope"), false);
// Unsorted input must not change the outcome.
assert.equal(makeIsDone([...statuses].reverse())("s1"), false);

const now = new Date("2026-08-26T12:00:00Z");
const s = summarize({
  now,
  statuses,
  members: [
    { id: "u1", name: "Daniel", avatarUrl: null },
    { id: "u2", name: "Kuba", avatarUrl: null },
    { id: "u3", name: "Marta", avatarUrl: null },
  ],
  milestones: [
    { id: "m1", title: "MVP", stopAt: "2026-09-25T00:00:00Z", taskStatusIds: ["s4", "s4", "s1", "s2"] },
    { id: "m2", title: "Puste", stopAt: "2026-10-10T00:00:00Z", taskStatusIds: [] },
    { id: "m3", title: "Spóźniony", stopAt: "2026-08-01T00:00:00Z", taskStatusIds: ["s1", "s4"] },
  ],
  tasks: [
    task({ id: "a", displayId: 245, statusColumnId: "s1", stopAt: "2026-08-01T00:00:00Z", assigneeIds: ["u1"] }),
    task({ id: "b", displayId: 256, statusColumnId: "s2", stopAt: "2026-08-20T00:00:00Z", assigneeIds: ["u1", "u2"] }),
    task({ id: "c", displayId: 257, statusColumnId: "s2", stopAt: "2026-12-01T00:00:00Z", assigneeIds: ["u1"] }),
    task({ id: "d", displayId: 258, statusColumnId: "s3", assigneeIds: ["u2"] }),
    // Done + past deadline must NOT count as overdue, and must not add workload.
    task({ id: "e", displayId: 259, statusColumnId: "s4", stopAt: "2026-01-01T00:00:00Z", assigneeIds: ["u3"] }),
    task({ id: "f", displayId: 260, statusColumnId: null }),
  ],
});

assert.equal(s.total, 6);
assert.equal(s.done, 1);
assert.equal(s.inProgress, 2, "„W toku” matches the named column, not every non-first column");
assert.deepEqual(s.overdue.map((t) => t.displayId), [256, 245]);
assert.deepEqual(
  s.statuses.map((x) => [x.name, x.count, x.pct]),
  [["Do zrobienia", 1, 17], ["W toku", 2, 33], ["Do poprawy", 1, 17], ["Gotowe", 1, 17], ["Bez statusu", 1, 17]],
);
assert.equal(s.statuses[1]!.share, 2 / 6);
// Workload = open tasks only, sorted desc; the person with just a done task drops to 0.
assert.deepEqual(s.workload.map((w) => [w.name, w.count, w.share]), [["Daniel", 3, 1], ["Kuba", 2, 2 / 3], ["Marta", 0, 0]]);
assert.deepEqual(
  s.milestones.map((m) => [m.title, m.done, m.total, m.share, m.late]),
  [["MVP", 2, 4, 0.5, false], ["Puste", 0, 0, 0, false], ["Spóźniony", 1, 2, 0.5, true]],
  "late = termin minął i nie wszystko zrobione",
);

// Board without any status columns: nothing is done, nothing is in progress.
const bare = summarize({ now, statuses: [], members: [], milestones: [], tasks: [task({ statusColumnId: "x" })] });
assert.deepEqual([bare.done, bare.inProgress, bare.total], [0, 0, 1]);
// Board without a „W toku”-like column falls back to „not first, not done”.
const fallback = summarize({
  now, members: [], milestones: [],
  statuses: [{ id: "a", name: "Backlog", colorHex: "#8A857D", order: 0 }, { id: "b", name: "Testy", colorHex: "#E8A100", order: 1 }, { id: "c", name: "Done", colorHex: "#1E9E5A", order: 2 }],
  tasks: [task({ statusColumnId: "a" }), task({ statusColumnId: "b" }), task({ statusColumnId: "c" })],
});
assert.deepEqual([fallback.done, fallback.inProgress], [1, 1]);

// Activity: known action → phrase, unknown → raw key (never an empty label).
assert.equal(activityPhrase("comment.created"), "skomentował(a)");
assert.equal(activityPhrase("taskline.row.rename"), "zmienił(a) linię zadań");
assert.equal(activityPhrase("something.new"), "something.new");

const day = 86_400_000;
const ref = new Date("2026-08-26T14:32:00");
assert.match(activityTime(new Date("2026-08-26T09:05:00"), ref), /^\d{2}:\d{2}$/);
assert.equal(activityTime(new Date(ref.getTime() - day), ref), "wczoraj");
// 3 days back = weekday abbreviation, 30 days back = day + month.
assert.match(activityTime(new Date(ref.getTime() - 3 * day), ref), /^[a-ząćęłńóśźż.]+$/i);
assert.match(activityTime(new Date(ref.getTime() - 30 * day), ref), /\d/);
// Just after midnight still counts as "today" (compare calendar days, not 24h windows).
assert.match(activityTime(new Date("2026-08-26T00:10:00"), ref), /^\d{2}:\d{2}$/);

console.log("summary aggregate + activity ok");
