// Self-check dla spisu „Na tej stronie": `npx tsx components/wiki/headings.check.ts`
import assert from "node:assert/strict";
import { extractHeadings, readingMinutes, slugify } from "./headings";

const h = (level: number, ...parts: string[]) => ({
  type: "heading",
  attrs: { level },
  content: parts.map((text) => ({ type: "text", text })),
});
const p = (text: string) => ({ type: "paragraph", content: [{ type: "text", text }] });

// Kolejność dokumentu, tylko h2, h1/h3 pomijane.
const doc = {
  type: "doc",
  content: [h(1, "Tytuł"), p("wstęp"), h(2, "Kiedy wydajemy"), p("x"), h(3, "Szczegół"), h(2, "Rollback")],
};
assert.deepEqual(
  extractHeadings(doc).map((x) => [x.id, x.text, x.index]),
  [
    ["kiedy-wydajemy", "Kiedy wydajemy", 0],
    ["rollback", "Rollback", 1],
  ],
);

// ZAGNIEŻDŻENIE: nagłówek w cytacie / w komórce tabeli też trafia do spisu,
// bo Tiptap renderuje go jako zwykły <h2>.
const nested = {
  type: "doc",
  content: [
    h(2, "Na wierzchu"),
    {
      type: "blockquote",
      content: [{ type: "table", content: [{ type: "tableRow", content: [{ type: "tableCell", content: [h(2, "W środku")] }] }] }],
    },
  ],
};
assert.deepEqual(extractHeadings(nested).map((x) => x.text), ["Na wierzchu", "W środku"]);

// DUPLIKATY: ten sam tekst → różne kotwice, żeby link prowadził gdzie trzeba.
const dupes = { type: "doc", content: [h(2, "Rollback"), h(2, "Rollback"), h(2, "Rollback")] };
assert.deepEqual(extractHeadings(dupes).map((x) => x.id), ["rollback", "rollback-2", "rollback-3"]);
assert.deepEqual(extractHeadings(dupes).map((x) => x.index), [0, 1, 2]);

// Nagłówek złożony z kilku fragmentów (bold/link) = jeden tekst.
assert.deepEqual(extractHeadings({ type: "doc", content: [h(2, "Checklista ", "przed wydaniem")] })[0], {
  id: "checklista-przed-wydaniem",
  text: "Checklista przed wydaniem",
  index: 0,
});

// Pusty nagłówek nie generuje pustej pozycji w spisie.
assert.deepEqual(extractHeadings({ type: "doc", content: [{ type: "heading", attrs: { level: 2 } }, h(2, "OK")] }).map((x) => x.text), ["OK"]);

// Slug bez znaków ASCII spada na fallback zamiast pustej kotwicy.
assert.equal(slugify("Zażółć gęślą jaźń", "x"), "zazolc-gesla-jazn");
assert.equal(slugify("《》", "sekcja-1"), "sekcja-1");
// Fallback numeruje się sam, więc dwa nieslugowalne nagłówki i tak są unikalne.
assert.deepEqual(extractHeadings({ type: "doc", content: [h(2, "《》"), h(2, "《》")] }).map((x) => x.id), ["sekcja-1", "sekcja-2"]);

// Puste / uszkodzone wejście nie wybucha.
assert.deepEqual(extractHeadings(null), []);
assert.deepEqual(extractHeadings({ type: "doc" }), []);

assert.equal(readingMinutes(null), 1);
assert.equal(readingMinutes({ type: "doc", content: [p("jedno zdanie tutaj")] }), 1);
assert.equal(readingMinutes({ type: "doc", content: [p(Array(600).fill("słowo").join(" "))] }), 3);

console.log("headings.check.ts OK");
