import assert from "node:assert/strict";
import { MAX_DETAILS, MAX_LABEL, normalizeDetails, parseDetails } from "./contracts-model";

// Kolejnosc wpisania zostaje, biale znaki znikaja.
assert.deepEqual(normalizeDetails(["Czas trwania umowy ", " Stały rabat hurtowy"], ["2 lata", "6% "]), [
  { label: "Czas trwania umowy", value: "2 lata" },
  { label: "Stały rabat hurtowy", value: "6%" },
]);
// Pusty wiersz po „Dodaj pole" odpada; wiersz bez etykiety tez (nie ma czego pokazac).
assert.deepEqual(normalizeDetails(["", "Okres wypowiedzenia", ""], ["x", "3 miesiące", ""]), [{ label: "Okres wypowiedzenia", value: "3 miesiące" }]);
// Etykieta bez wartosci zostaje — user moze uzupelnic pozniej.
assert.deepEqual(normalizeDetails(["Kontrahent"], [""]), [{ label: "Kontrahent", value: "" }]);
// Nierowne listy (przegladarka pominela pole) nie wywalaja.
assert.deepEqual(normalizeDetails(["A", "B"], ["1"]), [{ label: "A", value: "1" }, { label: "B", value: "" }]);
// Limity: dlugosc etykiety i liczba pol.
assert.equal(normalizeDetails(["x".repeat(200)], ["v"])[0]!.label.length, MAX_LABEL);
assert.equal(normalizeDetails(Array(70).fill("L"), Array(70).fill("V")).length, MAX_DETAILS);

// Odczyt z bazy: smieci nie wywalaja strony.
assert.deepEqual(parseDetails(null), []);
assert.deepEqual(parseDetails("nie tablica"), []);
assert.deepEqual(parseDetails([{ label: "A", value: 5 }, { label: "" }, 7, null]), [{ label: "A", value: "5" }]);

console.log("contracts-model: OK");
