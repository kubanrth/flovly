// F13 „Zapotrzebowanie" — czysta logika. Link jest renderowany jako <a>, wiec
// przepuszczamy tylko http(s); „javascript:" i podobne nigdy nie trafia do href.
// Self-check: `npx tsx components/purchases/purchases-model.check.ts`.

export const MAX_LINK = 2000;

/** Zwraca bezpieczny URL (dopisuje https:// gdy brak schematu) albo null, gdy to nie link. */
export function normalizeLink(raw: string): string | null {
  const t = raw.trim().slice(0, MAX_LINK);
  if (!t) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(t) ? t : `https://${t}`;
  try {
    const u = new URL(withScheme);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

/** Domena do pokazania obok linku, bez www. */
export function linkHost(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}
