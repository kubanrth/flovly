// Self-check dla czystych helperów E6: `npx tsx components/passwords/vault-model.check.ts`
import assert from "node:assert/strict";
import { changedLabel, countdown, REVEAL_MS, revealState } from "./vault-model";

assert.equal(countdown(0), "0:00");
assert.equal(countdown(5), "0:05");
assert.equal(countdown(30), "0:30");
assert.equal(countdown(65), "1:05");
assert.equal(countdown(-3), "0:00", "licznik nigdy nie schodzi poniżej zera");

// Start odsłonięcia: pełne 30 s, jeszcze nie wygasło.
const t0 = revealState(1_000, 1_000);
assert.equal(t0.secondsLeft, 30);
assert.equal(t0.label, "odsłonięte 0:30");
assert.equal(t0.expired, false);

// Ułamek sekundy zaokrąglamy w górę — użytkownik nie widzi „0:29" po 100 ms.
assert.equal(revealState(0, 100).label, "odsłonięte 0:30");
assert.equal(revealState(0, 1_000).label, "odsłonięte 0:29");
assert.equal(revealState(0, 29_999).secondsLeft, 1);

// Granica: dokładnie 30 s = ukryte. Nigdy „jeszcze chwilkę".
assert.equal(revealState(0, REVEAL_MS).expired, true);
assert.equal(revealState(0, REVEAL_MS).label, "odsłonięte 0:00");
assert.equal(revealState(0, REVEAL_MS + 60_000).expired, true);

// Cofnięty zegar nie może wydłużyć okna odsłonięcia ponad ttl.
assert.equal(revealState(10_000, 0).secondsLeft, 30);
assert.equal(revealState(10_000, 0).expired, false);

const NOW = Date.parse("2026-08-27T12:00:00Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();
assert.equal(changedLabel(ago(10_000), NOW), "przed chwilą");
assert.equal(changedLabel(ago(5 * 60_000), NOW), "5 min temu");
assert.equal(changedLabel(ago(3 * 3_600_000), NOW), "3 godz. temu");
assert.equal(changedLabel(ago(30 * 3_600_000), NOW), "wczoraj");
assert.equal(changedLabel(ago(3 * 86_400_000), NOW), "3 dni temu");
assert.equal(changedLabel(ago(1.2 * 86_400_000), NOW), "wczoraj");
assert.equal(changedLabel(ago(9 * 86_400_000), NOW), "1 tyg. temu");
assert.equal(changedLabel(ago(60 * 86_400_000), NOW), "2 mies. temu");
assert.equal(changedLabel(ago(400 * 86_400_000), NOW), "1 rok temu");
assert.equal(changedLabel(ago(800 * 86_400_000), NOW), "2 lata temu");
// Data z przyszłości (skew) nie wywala formatu.
assert.equal(changedLabel(new Date(NOW + 60_000).toISOString(), NOW), "przed chwilą");

console.log("vault-model.check.ts OK");
