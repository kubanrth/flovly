// Self-check dla czystej logiki E5: `npx tsx components/subscriptions/money.check.ts`
import assert from "node:assert/strict";
import { centsToInput, formatPln, formatPlnRounded, parseAmountPln, rollUp } from "./money";

// ── parseAmountPln ────────────────────────────────────────────────────────
// Oba zapisy tej samej kwoty muszą dać ten sam wynik — to jest cały sens funkcji.
assert.equal(parseAmountPln("129,99"), 12999);
assert.equal(parseAmountPln("129.99"), 12999);
assert.equal(parseAmountPln("129,99"), parseAmountPln("129.99"));
// Separator tysięcy: zwykła spacja i NBSP (tym drugim rozdziela Intl).
assert.equal(parseAmountPln("1 299,00"), 129900);
assert.equal(parseAmountPln("1 299,00"), 129900);
// Jedna cyfra po przecinku to nadal kwota.
assert.equal(parseAmountPln("129,9"), 12990);
// Puste pole = 0 zł (użytkownik czyści komórkę), nie błąd.
assert.equal(parseAmountPln(""), 0);
assert.equal(parseAmountPln("   "), 0);
// Śmieci i wartości poza zakresem → null, czyli „nie zapisuj".
assert.equal(parseAmountPln("abc"), null);
assert.equal(parseAmountPln("12,345"), null);
assert.equal(parseAmountPln("-5"), null);
assert.equal(parseAmountPln("1e5"), null);
assert.equal(parseAmountPln("10000001"), null);
assert.equal(parseAmountPln("10000000"), 1_000_000_000);

// ── formatowanie ──────────────────────────────────────────────────────────
assert.equal(formatPln(12999), "129,99 zł");
assert.equal(formatPln(0), "0,00 zł");
assert.equal(formatPln(5), "0,05 zł");
assert.equal(formatPln(129900), "1 299,00 zł");
assert.equal(formatPlnRounded(431_800), "4 318 zł");
assert.equal(formatPlnRounded(5_181_600), "51 816 zł");
// Runda w górę na pół grosza w kaflu.
assert.equal(formatPlnRounded(150), "2 zł");

// Edycja pokazuje surową kwotę bez „zł", pusta komórka zostaje pusta.
assert.equal(centsToInput(12999), "129,99");
assert.equal(centsToInput(28800), "288,00");
assert.equal(centsToInput(0), "");
// Round-trip: to co widać w inpucie da się z powrotem sparsować.
assert.equal(parseAmountPln(centsToInput(12999)), 12999);
assert.equal(parseAmountPln(centsToInput(129900)), 129900);

// ── rollUp ────────────────────────────────────────────────────────────────
// Mieszanka cykli — miesięczna 100 zł + roczna 1200 zł.
const mixed = [
  { amountCents: 10_000, cycle: "MONTHLY" as const },
  { amountCents: 120_000, cycle: "YEARLY" as const },
];
assert.deepEqual(rollUp(mixed), { monthlyCents: 20_000, yearlyCents: 240_000 });
// Sama roczna: 1/12 w kaflu miesięcznym.
assert.deepEqual(rollUp([{ amountCents: 120_000, cycle: "YEARLY" }]), {
  monthlyCents: 10_000,
  yearlyCents: 120_000,
});
// Same miesięczne: ×12 w prognozie rocznej.
assert.deepEqual(rollUp([{ amountCents: 28_800, cycle: "MONTHLY" }]), {
  monthlyCents: 28_800,
  yearlyCents: 345_600,
});
// Zaokrąglenie liczone na sumie, nie per wiersz: 3 × (100 zł/rok) = 25 zł/mies,
// a nie 3 × 8,33 zł = 24,99 zł.
assert.deepEqual(
  rollUp([
    { amountCents: 10_000, cycle: "YEARLY" },
    { amountCents: 10_000, cycle: "YEARLY" },
    { amountCents: 10_000, cycle: "YEARLY" },
  ]),
  { monthlyCents: 2500, yearlyCents: 30_000 },
);
assert.deepEqual(rollUp([]), { monthlyCents: 0, yearlyCents: 0 });

console.log("money.check.ts OK");
