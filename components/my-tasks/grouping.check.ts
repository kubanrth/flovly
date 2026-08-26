// Self-check for the pure /my-tasks helpers: `npx tsx components/my-tasks/grouping.check.ts`
import assert from "node:assert/strict";
import { capGroups, dueBucket, formatDue, groupRows, openSummary, startOfNextWeek, type MyTaskRow } from "./grouping";

const row = (over: Partial<MyTaskRow>): MyTaskRow => ({
  id: "t", displayId: 1, title: "x", workspaceId: "w", boardId: "b", boardName: "Tablica",
  statusName: null, statusColorHex: null, priority: "NONE", stopAt: null, doneColumnId: null, assigneeIds: [],
  ...over,
});

// Środa 2026-08-26 12:00 lokalnie.
const now = new Date(2026, 7, 26, 12, 0, 0);
const at = (y: number, m: number, d: number, h = 0, min = 0, s = 0, ms = 0) =>
  new Date(y, m, d, h, min, s, ms).toISOString();

// Granica północy: koniec wczorajszego dnia = po terminie, początek dzisiejszego = ten tydzień.
assert.equal(dueBucket(at(2026, 7, 25, 23, 59, 59, 999), now), "overdue");
assert.equal(dueBucket(at(2026, 7, 26, 0, 0, 0, 0), now), "week");
assert.equal(dueBucket(at(2026, 7, 26, 23, 59, 59, 999), now), "week");
// Niedziela 30 sie kończy tydzień, poniedziałek 31 sie to już „Później”.
assert.equal(startOfNextWeek(now).getTime(), new Date(2026, 7, 31).getTime());
assert.equal(dueBucket(at(2026, 7, 30, 23, 59), now), "week");
assert.equal(dueBucket(at(2026, 7, 31, 0, 0), now), "later");
assert.equal(dueBucket(null, now), "nodate");
// Sama północ w niedzielę liczona z niedzieli — nowy tydzień zaczyna się w poniedziałek.
assert.equal(startOfNextWeek(new Date(2026, 7, 30, 23, 59)).getTime(), new Date(2026, 7, 31).getTime());

const rows: MyTaskRow[] = [
  row({ id: "a", displayId: 256, stopAt: at(2026, 7, 25), priority: "HIGH" }),
  row({ id: "b", displayId: 245, stopAt: at(2026, 7, 21), priority: "MEDIUM" }),
  row({ id: "c", displayId: 250, stopAt: at(2026, 7, 29), priority: "URGENT", boardId: "b2", boardName: "Sklep" }),
  row({ id: "d", displayId: 254, stopAt: at(2026, 7, 30) }),
  row({ id: "e", displayId: 259, stopAt: at(2026, 8, 12) }),
  row({ id: "f", displayId: 260 }),
];

const due = groupRows(rows, "due", now);
assert.deepEqual(due.map((g) => [g.label, g.rows.length]), [
  ["Po terminie", 2], ["Ten tydzień", 2], ["Później", 1], ["Bez terminu", 1],
]);
assert.equal(due[0]!.tone, "danger");
// Po terminie sortowane rosnąco po dacie: 21 sie przed 25 sie.
assert.deepEqual(due[0]!.rows.map((r) => r.displayId), [245, 256]);
// Bez zadań bez terminu grupa „Bez terminu” znika, trzy pozostałe nagłówki zostają.
assert.deepEqual(
  groupRows([row({ stopAt: at(2026, 7, 25) })], "due", now).map((g) => g.label),
  ["Po terminie", "Ten tydzień", "Później"],
);

assert.deepEqual(groupRows(rows, "board", now).map((g) => [g.label, g.rows.length]), [["Sklep", 1], ["Tablica", 5]]);
assert.deepEqual(groupRows(rows, "priority", now).map((g) => [g.label, g.rows.length]), [
  ["Pilne", 1], ["Wysoki priorytet", 1], ["Średni priorytet", 1], ["Bez priorytetu", 3],
]);
// keepServerOrder = kolejność z zapytania zostaje nietknięta.
assert.deepEqual(groupRows(rows, "due", now, true)[0]!.rows.map((r) => r.displayId), [256, 245]);

// Cap 7 na makietowym rozkładzie 2/3/7 → 2/3/2 i 5 ukrytych; każda grupa zachowuje wiersz.
const many = groupRows(
  [
    ...rows.slice(0, 2),
    row({ id: "c", stopAt: at(2026, 7, 29) }), row({ id: "d", stopAt: at(2026, 7, 30) }), row({ id: "e", stopAt: at(2026, 7, 30) }),
    ...Array.from({ length: 7 }, (_, i) => row({ id: `l${i}`, displayId: 300 + i, stopAt: at(2026, 8, 10 + i) })),
  ],
  "due",
  now,
);
const capped = capGroups(many, 7);
assert.deepEqual(capped.groups.map((g) => g.rows.length), [2, 3, 2]);
assert.equal(capped.hidden, 5);
assert.equal(capGroups(many, 100).hidden, 0);
// Skrajny przypadek: budżet mniejszy niż liczba grup — każda i tak pokazuje jeden wiersz.
assert.deepEqual(capGroups(many, 1).groups.map((g) => g.rows.length), [1, 1, 1]);

assert.equal(formatDue(at(2026, 7, 25), "overdue"), "25 sie");
assert.equal(formatDue(at(2026, 7, 29), "week"), "sob 29 sie"); // 29 sie 2026 = sobota
assert.equal(openSummary(12, 3), "12 otwartych w 3 tablicach");
assert.equal(openSummary(1, 1), "1 otwarte w 1 tablicy");

console.log("my-tasks grouping ok");
