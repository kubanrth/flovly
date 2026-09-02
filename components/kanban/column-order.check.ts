// Self-check: `npx tsx components/kanban/column-order.check.ts`
import assert from "node:assert/strict";
import { NO_STATUS } from "./kanban-model";
import { COL_DRAG_PREFIX, columnIdFromDragId, columnOfDropTarget, isColumnDragId, nextColumnOrder } from "./column-order";

const cols = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
const ids = (r: { id: string }[] | null) => r?.map((c) => c.id).join(",") ?? null;

// prefiks ma 8 znakow — obciecie o jeden za duzo dawalo id bez pierwszej litery
assert.equal(COL_DRAG_PREFIX.length, 8);
assert.equal(columnIdFromDragId("colsort:abc"), "abc");
assert.ok(isColumnDragId("colsort:abc"));
assert.ok(!isColumnDragId("col:abc"));
assert.ok(!isColumnDragId("abc"));

// punkt upuszczenia: naglowek / obszar kolumny / karta
const kolumnaZadania = (t: string) => (t === "t1" ? "c" : null);
assert.equal(columnOfDropTarget("colsort:c", kolumnaZadania), "c");
assert.equal(columnOfDropTarget("col:c", kolumnaZadania), "c");
assert.equal(columnOfDropTarget("t1", kolumnaZadania), "c");
assert.equal(columnOfDropTarget("nieznane", kolumnaZadania), null);

// w prawo i w lewo
assert.equal(ids(nextColumnOrder(cols, "a", "c")), "b,c,a,d");
assert.equal(ids(nextColumnOrder(cols, "d", "b")), "a,d,b,c");
assert.equal(ids(nextColumnOrder(cols, "a", "b")), "b,a,c,d");

// przypadki bez zmiany
assert.equal(nextColumnOrder(cols, "a", "a"), null);
assert.equal(nextColumnOrder(cols, "a", null), null);
assert.equal(nextColumnOrder(cols, "a", NO_STATUS), null, "Bez statusu nie jest celem — nie ma wiersza w bazie");
assert.equal(nextColumnOrder(cols, NO_STATUS, "a"), null, "Bez statusu nie da sie przestawic");
assert.equal(nextColumnOrder(cols, "x", "a"), null);
assert.equal(nextColumnOrder(cols, "a", "x"), null);

// komplet kolumn zostaje — akcja zapisuje `order` po indeksie tablicy
const wynik = nextColumnOrder(cols, "a", "c")!;
assert.equal(wynik.length, cols.length);
assert.deepEqual([...wynik].map((c) => c.id).sort(), ["a", "b", "c", "d"]);

console.log("column-order: OK");
