// Self-check: `npx tsx components/sales/pipeline-model.check.ts`
import assert from "node:assert/strict";
import {
  formatAmount,
  formatSums,
  openDeals,
  quarterOf,
  sumByCurrency,
  wonInQuarter,
  type DealLite,
  type StageLite,
} from "./pipeline-model";

// ── granice kwartału ──────────────────────────────────────────────
const q3 = quarterOf(new Date(2026, 7, 27)); // sierpień = Q3
assert.equal(q3.label, "Q3 2026");
assert.equal(q3.start.getTime(), new Date(2026, 6, 1).getTime());
assert.equal(q3.end.getTime(), new Date(2026, 9, 1).getTime());
assert.equal(quarterOf(new Date(2026, 0, 1)).label, "Q1 2026");
assert.equal(quarterOf(new Date(2026, 11, 31)).label, "Q4 2026");
// styczeń nie wycieka do poprzedniego roku
assert.equal(quarterOf(new Date(2026, 0, 1)).start.getFullYear(), 2026);

// ── kwoty ─────────────────────────────────────────────────────────
assert.equal(formatAmount(850, "PLN"), "850 zł");
assert.equal(formatAmount(24_000, "PLN"), "24 tys. zł");
assert.equal(formatAmount(24_500, "PLN"), "24,5 tys. zł");
assert.equal(formatAmount(1_200_000, "PLN"), "1,2 mln zł");
assert.equal(formatAmount(5_000, "EUR"), "5 tys. EUR");
assert.equal(formatSums({}), "—");
assert.equal(formatSums({ PLN: 186_000 }), "186 tys. zł");
assert.equal(formatSums({ PLN: 1_000, EUR: 2_000 }), "2 tys. EUR · 1 tys. zł");

// ── sumy i filtry ─────────────────────────────────────────────────
const stages: StageLite[] = [
  { id: "lead", name: "Lead", colorHex: "#0A84FF", order: 0, closedKind: null },
  { id: "won", name: "Wygrane", colorHex: "#34C759", order: 1, closedKind: "won" },
  { id: "lost", name: "Przegrane", colorHex: "#FF3B30", order: 2, closedKind: "lost" },
];
const byId = new Map(stages.map((s) => [s.id, s]));
const deals: DealLite[] = [
  { id: "a", stageId: "lead", valueAmount: 24_000, valueCurrency: "PLN", closedAt: null },
  { id: "b", stageId: "lead", valueAmount: null, valueCurrency: "PLN", closedAt: null },
  { id: "c", stageId: "lead", valueAmount: 1_000, valueCurrency: "EUR", closedAt: null },
  { id: "d", stageId: "won", valueAmount: 96_000, valueCurrency: "PLN", closedAt: "2026-08-10T00:00:00.000Z" },
  { id: "e", stageId: "won", valueAmount: 50_000, valueCurrency: "PLN", closedAt: "2026-02-10T00:00:00.000Z" },
  { id: "f", stageId: "lost", valueAmount: 9_000, valueCurrency: "PLN", closedAt: "2026-08-11T00:00:00.000Z" },
];

// null-owa kwota nie psuje sumy, waluty się nie mieszają
assert.deepEqual(sumByCurrency(deals.filter((d) => d.stageId === "lead")), { PLN: 24_000, EUR: 1_000 });
assert.deepEqual(sumByCurrency([]), {});

// „W pipeline" pomija zarówno wygrane, jak i przegrane
assert.deepEqual(openDeals(deals, byId).map((d) => d.id), ["a", "b", "c"]);

// „Wygrane Q3" bierze tylko wygrane z tego kwartału
assert.deepEqual(wonInQuarter(deals, byId, q3).map((d) => d.id), ["d"]);
// deal bez daty zamknięcia nie wpada do kafla
assert.deepEqual(
  wonInQuarter([{ id: "x", stageId: "won", valueAmount: 1, valueCurrency: "PLN", closedAt: null }], byId, q3),
  [],
);

console.log("pipeline-model ok");
