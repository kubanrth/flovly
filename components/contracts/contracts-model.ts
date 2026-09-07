// F13 „Umowy" — pola definiowane przez uzytkownika. Czysta logika, bez React
// i bazy: normalizacja z formularza i bezpieczny odczyt JSON-a z bazy.
// Self-check: `npx tsx components/contracts/contracts-model.check.ts`.

export interface ContractDetail { label: string; value: string }

export const MAX_DETAILS = 50;
export const MAX_LABEL = 80;
export const MAX_VALUE = 500;

/**
 * Z formularza przychodza rownolegle listy etykiet i wartosci (takze puste
 * wiersze po „Dodaj pole"). Zostaja tylko wiersze z etykieta, przyciete do
 * limitow, w kolejnosci wpisania.
 */
export function normalizeDetails(labels: readonly string[], values: readonly string[]): ContractDetail[] {
  const out: ContractDetail[] = [];
  for (let i = 0; i < Math.max(labels.length, values.length); i++) {
    const label = (labels[i] ?? "").trim().slice(0, MAX_LABEL);
    const value = (values[i] ?? "").trim().slice(0, MAX_VALUE);
    if (!label) continue;
    out.push({ label, value });
    if (out.length === MAX_DETAILS) break;
  }
  return out;
}

/** JSON z bazy moze byc czymkolwiek (stara wersja, reczna edycja) — nigdy nie wywalamy strony. */
export function parseDetails(raw: unknown): ContractDetail[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((d) => (d && typeof d === "object" ? { label: String((d as ContractDetail).label ?? "").trim(), value: String((d as ContractDetail).value ?? "").trim() } : null))
    .filter((d): d is ContractDetail => !!d && d.label.length > 0);
}
