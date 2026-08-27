// Self-check dla czystych helperów E9: `npx tsx components/support/support-model.check.ts`
import assert from "node:assert/strict";
import { inQueue, queueCounts, RESOLVED_WINDOW_MS, ticketCode, type QueueTicket } from "./support-model";

const NOW = Date.parse("2026-08-27T12:00:00Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();

const open: QueueTicket = { status: "OPEN", resolvedAt: null };
const inProgress: QueueTicket = { status: "IN_PROGRESS", resolvedAt: null };
const freshlyResolved: QueueTicket = { status: "RESOLVED", resolvedAt: ago(2 * 86_400_000) };
const oldResolved: QueueTicket = { status: "RESOLVED", resolvedAt: ago(45 * 86_400_000) };
const closedNoStamp: QueueTicket = { status: "CLOSED", resolvedAt: null };

// Każde zgłoszenie trafia do dokładnie jednej kolejki (albo do żadnej).
assert.equal(inQueue(open, "open", NOW), true);
assert.equal(inQueue(open, "in_progress", NOW), false);
assert.equal(inQueue(open, "resolved", NOW), false);
assert.equal(inQueue(inProgress, "in_progress", NOW), true);
assert.equal(inQueue(inProgress, "open", NOW), false);

// Okno 30 dni: brzeg wpada, dzień po nim wypada.
assert.equal(inQueue({ status: "RESOLVED", resolvedAt: ago(RESOLVED_WINDOW_MS) }, "resolved", NOW), true);
assert.equal(inQueue({ status: "RESOLVED", resolvedAt: ago(RESOLVED_WINDOW_MS + 1) }, "resolved", NOW), false);
assert.equal(inQueue(freshlyResolved, "resolved", NOW), true);
assert.equal(inQueue(oldResolved, "resolved", NOW), false);

// Zamknięte bez `resolvedAt` (dane sprzed migracji) nie mogą zniknąć z UI.
assert.equal(inQueue(closedNoStamp, "resolved", NOW), true);
assert.equal(inQueue({ status: "CLOSED", resolvedAt: "nie-data" }, "resolved", NOW), true);

assert.deepEqual(queueCounts([open, open, inProgress, freshlyResolved, oldResolved, closedNoStamp], NOW), {
  open: 2,
  in_progress: 1,
  resolved: 2,
});
assert.deepEqual(queueCounts([], NOW), { open: 0, in_progress: 0, resolved: 0 });

// Kod zgłoszenia: stabilny, wielkie litery, zawsze 5 znaków po myślniku.
assert.equal(ticketCode("clx9a2b3c0000abcd8842xyz9"), "SUP-2XYZ9");
assert.equal(ticketCode("cmf0k2p9q0001ticket90412"), "SUP-90412");
assert.equal(ticketCode("abc"), "SUP-ABC");
assert.equal(ticketCode(""), "SUP-?????");
assert.equal(ticketCode("a-b_c-d-e-f"), "SUP-BCDEF", "separatory nie wchodzą do kodu");
assert.equal(ticketCode("clx9a2b3c0000abcd8842xyz9"), ticketCode("clx9a2b3c0000abcd8842xyz9"));

console.log("support-model.check.ts OK");
