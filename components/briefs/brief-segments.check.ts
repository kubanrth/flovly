// Self-check: `npx tsx components/briefs/brief-segments.check.ts`
import assert from "node:assert/strict";
import { briefExcerpt, isRealised, selectBriefs, type BriefLite } from "./brief-segments";

assert.equal(isRealised("APPROVED"), true);
assert.equal(isRealised("ARCHIVED"), true);
assert.equal(isRealised("DRAFT"), false);
assert.equal(isRealised("IN_REVIEW"), false);

const at = (d: string) => new Date(d).toISOString();
const briefs: BriefLite[] = [
  { id: "draft-old", status: "DRAFT", createdAt: at("2026-01-01"), updatedAt: at("2026-01-05") },
  { id: "draft-new", status: "DRAFT", createdAt: at("2026-03-01"), updatedAt: at("2026-03-02") },
  { id: "review", status: "IN_REVIEW", createdAt: at("2026-02-01"), updatedAt: at("2026-02-02") },
  { id: "approved", status: "APPROVED", createdAt: at("2026-01-10"), updatedAt: at("2026-04-01") },
  { id: "archived", status: "ARCHIVED", createdAt: at("2026-01-11"), updatedAt: at("2026-05-01") },
];

// „Najpopularniejsze": recenzja przed szkicami, potem najświeższa zmiana.
assert.deepEqual(selectBriefs(briefs, "top").map((b) => b.id), ["review", "draft-new", "draft-old"]);
// „Najnowsze": otwarte wg daty utworzenia malejąco.
assert.deepEqual(selectBriefs(briefs, "new").map((b) => b.id), ["draft-new", "review", "draft-old"]);
// „Zrealizowane": APPROVED + ARCHIVED, najświeższa zmiana pierwsza.
assert.deepEqual(selectBriefs(briefs, "done").map((b) => b.id), ["archived", "approved"]);
// Cztery statusy pokrywają dokładnie dwa kubełki — nic nie ginie.
assert.equal(selectBriefs(briefs, "top").length + selectBriefs(briefs, "done").length, briefs.length);
// Wejście nie jest mutowane w miejscu.
assert.equal(briefs[0]!.id, "draft-old");
assert.deepEqual(selectBriefs([], "top"), []);

// ── opis karty ────────────────────────────────────────────────────
const doc = {
  type: "doc",
  content: [
    { type: "heading", content: [{ type: "text", text: "🎯 Cel projektu" }] },
    { type: "paragraph", content: [] },
    { type: "paragraph", content: [{ type: "text", text: "  Krótko o co   chodzi.\n" }] },
    { type: "paragraph", content: [{ type: "text", text: "Drugi akapit." }] },
  ],
};
// nagłówek i pusty akapit pomijane, białe znaki zwijane
assert.equal(briefExcerpt(doc), "Krótko o co chodzi.");
assert.equal(briefExcerpt(null), "");
assert.equal(briefExcerpt({ type: "doc" }), "");
// przycięcie z wielokropkiem
assert.equal(
  briefExcerpt({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "abcdefghij" }] }] }, 5),
  "abcd…",
);

console.log("brief-segments ok");
