// Self-check czystej logiki Linii zadań: `npx tsx components/canvas/taskline-stages.check.ts`
import assert from "node:assert/strict";
import {
  bucketOlder,
  cardsByStage,
  plural,
  reorderIds,
  sortStages,
  type TaskLineCard,
} from "./taskline-stages";

const card = (over: Partial<TaskLineCard> & { id: string }): TaskLineCard => ({
  taskId: `t-${over.id}`,
  taskTitle: "x",
  displayId: 1,
  statusName: null,
  statusColor: null,
  flowMark: null,
  x: 0,
  lineId: "s1",
  ...over,
});

// Etapy: rosnąco po order, remis rozstrzyga id (stabilny render).
assert.deepEqual(
  sortStages([
    { id: "b", name: "B", order: 1 },
    { id: "a", name: "A", order: 1 },
    { id: "c", name: "C", order: 0 },
  ]).map((s) => s.id),
  ["c", "a", "b"],
);

// Karty trafiają do swojego etapu, w każdym posortowane po x; sieroty giną.
const grouped = cardsByStage(
  [
    card({ id: "n2", x: 2000, lineId: "s1" }),
    card({ id: "n1", x: 1000, lineId: "s1" }),
    card({ id: "n3", x: 0, lineId: "s2" }),
    card({ id: "n4", x: 0, lineId: "usunięty-etap" }),
  ],
  [
    { id: "s1", name: "Zgłoszenie", order: 0 },
    { id: "s2", name: "Wycena", order: 1 },
  ],
);
assert.deepEqual(grouped.get("s1")!.map((c) => c.id), ["n1", "n2"]);
assert.deepEqual(grouped.get("s2")!.map((c) => c.id), ["n3"]);
assert.equal(grouped.size, 2);

// „Pokaż N starsze…": 6 kart → widać 2, ukrytych 4 (jak w B10).
assert.deepEqual(bucketOlder([1, 2, 3, 4, 5, 6], false), { shown: [1, 2], hidden: 4 });
assert.deepEqual(bucketOlder([1, 2, 3, 4, 5, 6], true), { shown: [1, 2, 3, 4, 5, 6], hidden: 0 });
assert.deepEqual(bucketOlder([1, 2], false), { shown: [1, 2], hidden: 0 });

// Przeciąganie: przed wskazaną kartą, na koniec, oraz gdy cel zniknął.
assert.deepEqual(reorderIds(["a", "b", "c"], "c", "a"), ["c", "a", "b"]);
assert.deepEqual(reorderIds(["a", "b", "c"], "a", null), ["b", "c", "a"]);
assert.deepEqual(reorderIds(["a", "b", "c"], "a", "a"), ["b", "c", "a"]);
assert.deepEqual(reorderIds(["a", "b", "c"], "b", "zniknęła"), ["a", "c", "b"]);

// Liczebniki w stopce.
assert.equal(plural(1, ["zadanie", "zadania", "zadań"]), "1 zadanie");
assert.equal(plural(3, ["zadanie", "zadania", "zadań"]), "3 zadania");
assert.equal(plural(16, ["zadanie", "zadania", "zadań"]), "16 zadań");
assert.equal(plural(12, ["etap", "etapy", "etapów"]), "12 etapów");
assert.equal(plural(22, ["etap", "etapy", "etapów"]), "22 etapy");
assert.equal(plural(0, ["etap", "etapy", "etapów"]), "0 etapów");

console.log("taskline-stages: OK");
