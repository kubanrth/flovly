// Self-check filtrowania emoji: `npx tsx components/ui/emoji-picker.check.ts`
// Wyszukiwarka ma działać bez ogonków — „uśmiech" i „usmiech" to to samo.
import assert from "node:assert/strict";

function fold(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ł/g, "l").toLowerCase();
}

assert.equal(fold("uśmiech"), "usmiech");
assert.equal(fold("Zrobione"), "zrobione");
assert.equal(fold("wdrożenie"), "wdrozenie");
assert.equal(fold("MODLITWA"), "modlitwa");
assert.equal(fold("zła"), "zla");
// Bez ogonków wpisane zapytanie musi trafiać w słowo z ogonkami i odwrotnie.
assert.ok(fold("wdrożenie start rakieta").includes(fold("rakieta")));
assert.ok(fold("pilne ogien hot").includes(fold("ogień")));
console.log("emoji search folding ok");
