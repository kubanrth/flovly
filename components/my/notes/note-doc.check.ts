// Self-check dla czystej logiki E3: `npx tsx components/my/notes/note-doc.check.ts`
import assert from "node:assert/strict";
import { countActions, countWords, folderCounts, noteDateLabel, noteDay, notePreview, noteTime } from "./note-doc";

// ── notePreview ───────────────────────────────────────────────────────────
assert.equal(notePreview(""), "");
assert.equal(notePreview("   \n\t "), "");
// Łamania linii i podwójne spacje spłaszczone do jednej — podgląd jest jednolinijkowy.
assert.equal(notePreview("Za dużo\n\nkontekstów   naraz"), "Za dużo kontekstów naraz");
// Krótsze niż limit — bez wielokropka.
assert.equal(notePreview("Krótka notatka", 90), "Krótka notatka");
// Dokładnie na granicy — nadal bez wielokropka.
assert.equal(notePreview("abcde", 5), "abcde");
// Za długie — ucięte na granicy słowa, z wielokropkiem, nigdy dłuższe niż max+1.
const long = notePreview("Deploy w piątek rano zamiast wieczorem — zero nadgodzin dla nikogo", 30);
assert.equal(long, "Deploy w piątek rano zamiast…");
assert.ok(long.length <= 31);
// Jedno bardzo długie słowo nie ma gdzie się złamać — tnie się twardo.
assert.equal(notePreview("aaaaaaaaaa", 5), "aaaaa…");

// ── countActions ──────────────────────────────────────────────────────────
const doc = {
  type: "doc",
  content: [
    { type: "paragraph", content: [{ type: "text", text: "Akcje sprintu 11" }] },
    {
      type: "taskList",
      content: [
        { type: "taskItem", attrs: { checked: true }, content: [{ type: "paragraph", content: [{ type: "text", text: "Szablon zgłoszenia" }] }] },
        { type: "taskItem", attrs: { checked: false }, content: [{ type: "paragraph", content: [{ type: "text", text: "WIP limit 5" }] }] },
        { type: "taskItem", attrs: { checked: false }, content: [{ type: "paragraph", content: [{ type: "text", text: "Zgłoszenia mailowe" }] }] },
      ],
    },
  ],
};
assert.deepEqual(countActions(doc), { total: 3, done: 1 });
// Zagnieżdżona lista zadań liczy się razem z rodzicem.
assert.deepEqual(
  countActions({
    type: "doc",
    content: [
      {
        type: "taskList",
        content: [
          {
            type: "taskItem",
            attrs: { checked: true },
            content: [{ type: "taskList", content: [{ type: "taskItem", attrs: { checked: true } }] }],
          },
        ],
      },
    ],
  }),
  { total: 2, done: 2 },
);
// Brak listy zadań / brak dokumentu → zero, bez wyjątku.
assert.deepEqual(countActions({ type: "doc", content: [{ type: "paragraph" }] }), { total: 0, done: 0 });
assert.deepEqual(countActions(null), { total: 0, done: 0 });

// ── countWords ────────────────────────────────────────────────────────────
assert.equal(countWords(doc), 10); // 3 słowa nagłówka + 2 + 3 + 2 z pozycji
assert.equal(countWords(null), 0);
assert.equal(countWords({ type: "doc", content: [] }), 0);

// ── folderCounts ──────────────────────────────────────────────────────────
assert.deepEqual(
  folderCounts([
    { folderId: "f1" },
    { folderId: "f1" },
    { folderId: "f2" },
    { folderId: null },
  ]),
  { none: 1, f1: 2, f2: 1 },
);
// Pusta lista nadal daje kubełek „bez folderu" na zero.
assert.deepEqual(folderCounts([]), { none: 0 });


// ── noteDateLabel ─────────────────────────────────────────────────────────
const TODAY = "2026-08-27";
assert.equal(noteDateLabel("2026-08-27T09:05:00.000Z", TODAY), `dziś ${noteTime("2026-08-27T09:05:00.000Z")}`);
assert.equal(noteDateLabel("2026-08-26T09:05:00.000Z", TODAY), "wczoraj");
// 20 sierpnia 2026 to czwartek.
assert.equal(noteDateLabel("2026-08-20T09:05:00.000Z", TODAY), "czw 20 sie");
// Inny rok — bez dnia tygodnia, za to z rokiem.
assert.equal(noteDateLabel("2025-12-31T09:05:00.000Z", TODAY), "31 gru 2025");
// Granica doby: 23:30 UTC 26 sierpnia to już 27 sierpnia 01:30 w Warszawie.
assert.equal(noteDay("2026-08-26T23:30:00.000Z"), "2026-08-27");

console.log("note-doc.check.ts OK");
