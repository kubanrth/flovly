// E10 „Wiki" — spis „Na tej stronie" liczony z nagłówków h2 dokumentu
// ProseMirror/Tiptap. Czysta funkcja, bez Reacta i bez DOM.
// Self-check: `npx tsx components/wiki/headings.check.ts`.

export interface DocHeading {
  /** Kotwica; unikalna nawet gdy dwa nagłówki mają ten sam tekst. */
  id: string;
  text: string;
  /** Pozycja w dokumencie — po niej podpinamy `id` do <h2> w DOM. */
  index: number;
}

type Node = { type?: string; text?: string; attrs?: { level?: number }; content?: unknown[] };

/** Skleja cały tekst węzła — nagłówek może mieć bold/link/code w środku. */
function textOf(node: Node): string {
  let out = "";
  const walk = (n: Node) => {
    if (typeof n.text === "string") out += n.text;
    if (Array.isArray(n.content)) for (const c of n.content) walk(c as Node);
  };
  walk(node);
  return out.replace(/\s+/g, " ").trim();
}

export function slugify(text: string, fallback: string): string {
  const base = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l") // „ł" nie ma formy rozkładalnej w NFD
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || fallback;
}

/**
 * Zbiera nagłówki poziomu `level` w kolejności dokumentu — także te
 * zagnieżdżone (np. w cytacie albo w komórce tabeli), bo Tiptap renderuje
 * je tak samo. Puste nagłówki są pomijane: nie da się do nich zalinkować.
 */
export function extractHeadings(doc: unknown, level = 2): DocHeading[] {
  const out: DocHeading[] = [];
  const used = new Map<string, number>();

  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const n = node as Node;
    if (n.type === "heading" && (n.attrs?.level ?? 1) === level) {
      const text = textOf(n);
      if (text) {
        const base = slugify(text, `sekcja-${out.length + 1}`);
        const seen = used.get(base) ?? 0;
        used.set(base, seen + 1);
        out.push({ id: seen === 0 ? base : `${base}-${seen + 1}`, text, index: out.length });
      }
      // Nagłówek nie zagnieżdża nagłówków — nie schodzimy głębiej.
      return;
    }
    if (Array.isArray(n.content)) for (const c of n.content) walk(c);
  };

  walk(doc);
  return out;
}

/** „czyta się N min" — 200 słów/min, minimum 1. */
export function readingMinutes(doc: unknown): number {
  let words = 0;
  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const n = node as Node;
    if (typeof n.text === "string") {
      const t = n.text.trim();
      if (t) words += t.split(/\s+/).length;
    }
    if (Array.isArray(n.content)) for (const c of n.content) walk(c);
  };
  walk(doc);
  return Math.max(1, Math.round(words / 200));
}
