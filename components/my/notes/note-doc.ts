// E3 Notatnik — czysta logika listy i stopki (bez Reacta, więc woła ją też RSC).
// Self-check: `npx tsx components/my/notes/note-doc.check.ts`

/** Węzeł dokumentu Tiptap — tyle, ile potrzeba do liczenia. */
type DocNode = {
  type?: string;
  text?: string;
  attrs?: { checked?: boolean } | null;
  content?: unknown[];
};

/**
 * Jednolinijkowy podgląd notatki: łamania i wielokrotne spacje zbite do jednej
 * spacji, ucięcie na granicy słowa + wielokropek. Pusta treść → "".
 */
export function notePreview(content: string, max = 90): string {
  const flat = content.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/**
 * „3 akcje (1 ukończona)" ze stopki makiety = pozycje listy zadań w dokumencie.
 * Tiptap trzyma stan w `attrs.checked` węzła `taskItem`.
 */
export function countActions(doc: unknown): { total: number; done: number } {
  let total = 0;
  let done = 0;
  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const n = node as DocNode;
    if (n.type === "taskItem") {
      total += 1;
      if (n.attrs?.checked === true) done += 1;
    }
    if (Array.isArray(n.content)) for (const child of n.content) walk(child);
  };
  walk(doc);
  return { total, done };
}

/** Liczba słów w dokumencie — stopka, gdy notatka nie ma listy akcji. */
export function countWords(doc: unknown): number {
  let text = "";
  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const n = node as DocNode;
    if (typeof n.text === "string") text += ` ${n.text}`;
    if (Array.isArray(n.content)) for (const child of n.content) walk(child);
  };
  walk(doc);
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

/**
 * Liczniki przy folderach w lewym panelu. Klucz `none` = notatki bez folderu;
 * folder bez notatek nie pojawia się w mapie (odczyt przez `?? 0`).
 */
export function folderCounts(
  notes: readonly { folderId: string | null }[],
): Record<string, number> {
  const counts: Record<string, number> = { none: 0 };
  for (const n of notes) {
    const key = n.folderId ?? "none";
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

// ── etykiety dat listy ────────────────────────────────────────────────────
// Strefa zapięta na sztywno, żeby SSR w kontenerze na UTC dał tę samą etykietę
// co hydracja w przeglądarce (ten sam trik co INBOX_TZ w D1).
const NOTE_TZ = "Europe/Warsaw";
const YMD = new Intl.DateTimeFormat("en-CA", { timeZone: NOTE_TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const HM = new Intl.DateTimeFormat("pl-PL", { timeZone: NOTE_TZ, hour: "2-digit", minute: "2-digit" });
const WEEKDAY = ["nd", "pon", "wt", "śr", "czw", "pt", "sob"];
const MONTH = ["sty", "lut", "mar", "kwi", "maj", "cze", "lip", "sie", "wrz", "paź", "lis", "gru"];

/** „YYYY-MM-DD" w strefie notatnika — kalendarzowy dzień, nie UTC. */
export function noteDay(iso: string | number | Date): string {
  return YMD.format(new Date(iso));
}

/** Godzina zapisu: „11:05". */
export function noteTime(iso: string | number | Date): string {
  return HM.format(new Date(iso));
}

/**
 * „dziś 11:05" / „wczoraj" / „śr 20 sie" / „15 sie 2025".
 * `today` przychodzi z serwera (YYYY-MM-DD), więc etykieta jest czysta.
 */
export function noteDateLabel(iso: string, today: string): string {
  const day = noteDay(iso);
  if (day === today) return `dziś ${noteTime(iso)}`;
  if (day === noteDay(new Date(`${today}T12:00:00Z`).getTime() - 86_400_000)) return "wczoraj";
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  const label = `${d} ${MONTH[m - 1]}`;
  if (day.slice(0, 4) === today.slice(0, 4)) {
    return `${WEEKDAY[new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay()]} ${label}`;
  }
  return `${label} ${y}`;
}
