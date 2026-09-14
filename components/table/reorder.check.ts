// Self-check: `npx tsx components/table/reorder.check.ts`
import assert from "node:assert/strict";
import { planDrop, resortByStatus, type ReorderRow } from "./reorder";

const row = (id: string, rowOrder: number, statusColumnId: string | null = "s1", parentId: string | null = null): ReorderRow => ({ id, rowOrder, statusColumnId, parentId });
const rows = [row("a", 1), row("b", 2), row("c", 3), row("d", 10, "s2"), row("e", 11, "s2")];

// w obrębie statusu: między sąsiadów
assert.deepEqual(planDrop(rows, "c", "a", "before"), { statusColumnId: "s1", rowOrder: 0 });
assert.deepEqual(planDrop(rows, "a", "b", "after"), { statusColumnId: "s1", rowOrder: 2.5 });
assert.deepEqual(planDrop(rows, "a", "c", "after"), { statusColumnId: "s1", rowOrder: 4 });
// przez granicę statusu: przejmuje status wiersza docelowego
assert.deepEqual(planDrop(rows, "a", "d", "after"), { statusColumnId: "s2", rowOrder: 10.5 });
assert.deepEqual(planDrop(rows, "e", "a", "before"), { statusColumnId: "s1", rowOrder: 0 });
// na siebie / tam, skąd wzięto / nieistniejące — brak ruchu
assert.equal(planDrop(rows, "b", "b", "after"), null);
assert.equal(planDrop(rows, "b", "a", "after"), null);
assert.equal(planDrop(rows, "b", "c", "before"), null);
assert.equal(planDrop(rows, "zz", "a", "before"), null);
// rodzeństwo: dziecko nie wskakuje między korzenie
const drzewo = [row("p", 1), row("k1", 2, "s1", "p"), row("k2", 3, "s1", "p"), row("q", 4)];
assert.equal(planDrop(drzewo, "k2", "q", "after"), null);
assert.deepEqual(planDrop(drzewo, "k2", "k1", "before"), { statusColumnId: "s1", rowOrder: 1 });
// grupowanie po czymś innym niż status: tylko w obrębie grupy
const grupa = (id: string) => (id === "d" || id === "e" ? "P1" : "P2");
assert.equal(planDrop(rows, "a", "d", "after", grupa), null);
assert.deepEqual(planDrop(rows, "d", "e", "after", grupa), { statusColumnId: "s2", rowOrder: 12 });

// lokalne ułożenie = klucz serwera, bez statusu na końcu, remisy wg wejścia
const idx = new Map([["s1", 0], ["s2", 1]]);
const ulozone = resortByStatus([row("x", 5, null), row("d", 10, "s2"), row("a", 2), row("b", 2), row("c", 0.5)], idx);
assert.deepEqual(ulozone.map((r) => r.id), ["c", "a", "b", "d", "x"]);

console.log("reorder: OK");
