// Self-check for the shared done-status rule: `npx tsx components/board/done-status.check.ts`
import assert from "node:assert/strict";
import { doneColumnIds, makeIsDone } from "./done-status";

const c = (id: string, name: string, order: number) => ({ id, name, order });

// A named done column wins even when other columns come after it — the bug that
// pushed finished tasks into „Zaległe” on /my-tasks.
const appended = [c("a", "Do zrobienia", 0), c("b", "W toku", 1), c("d", "Done", 3), c("x", "FAZA-2030", 4), c("y", "test", 5)];
assert.deepEqual([...doneColumnIds(appended)], ["d"]);
const isDone = makeIsDone(appended);
assert.equal(isDone("d"), true);
assert.equal(isDone("y"), false, "the terminal column must not count once a named done column exists");
assert.equal(isDone(null), false);
assert.equal(isDone(undefined), false);

// No named column → fall back to the terminal column by order, not by array position.
assert.deepEqual([...doneColumnIds([c("a", "Backlog", 2), c("b", "Review", 9), c("c", "Nowe", 0)])], ["b"]);

// Polish and English spellings, case- and whitespace-insensitive.
for (const name of ["Gotowe", " done ", "ZAKOŃCZONE", "Ukonczone", "Zamknięte", "Completed"]) {
  assert.deepEqual([...doneColumnIds([c("a", "Nowe", 0), c("z", name, 1)])], ["z"], name);
}
// Substrings must not match: „Gotowe do testów” is not a done column, so this
// board has no named one and falls back to its terminal column instead.
const loose = [c("a", "Nowe", 0), c("z", "Gotowe do testów", 1), c("k", "Archiwum", 2)];
assert.deepEqual([...doneColumnIds(loose)], ["k"]);
assert.equal(makeIsDone(loose)("z"), false);

assert.deepEqual([...doneColumnIds([])], []);
console.log("done-status ok");
