// E6 „Hasła" — czysta logika sejfu: odliczanie odsłonięcia i etykieta
// kolumny „Zmienione". Bez Reacta, bez DOM, bez sekretów.
// Self-check: `npx tsx components/passwords/vault-model.check.ts`.

import { plPlural } from "@/lib/pluralize";

/**
 * Odsłonięte hasło znika z ekranu po tylu ms. NIE wydłużać — to jedyne,
 * co ogranicza czas życia plaintextu na ekranie wspólnego sejfu.
 */
export const REVEAL_MS = 30_000;

export interface RevealState {
  /** Pełne sekundy do ukrycia (0…30). */
  secondsLeft: number;
  /** „odsłonięte 0:07" — licznik z makiety E6. */
  label: string;
  expired: boolean;
}

/** `m:ss`, bez wartości ujemnych. */
export function countdown(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function revealState(revealedAt: number, now: number, ttlMs = REVEAL_MS): RevealState {
  // Ujemny elapsed (przestawiony zegar) traktujemy jak 0 — nigdy jako
  // „więcej czasu na ekranie".
  const elapsed = Math.max(0, now - revealedAt);
  const left = Math.max(0, ttlMs - elapsed);
  const secondsLeft = Math.ceil(left / 1000);
  return {
    secondsLeft,
    label: `odsłonięte ${countdown(secondsLeft)}`,
    expired: left <= 0,
  };
}

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/**
 * Etykieta kolumny „Zmienione" — liczona z upływu czasu, nie z dni
 * kalendarzowych, żeby serwer w UTC i klient w Europe/Warsaw dawały to samo.
 */
export function changedLabel(iso: string, nowMs: number): string {
  const ms = nowMs - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < MIN) return "przed chwilą";
  if (ms < HOUR) {
    const n = Math.floor(ms / MIN);
    return `${n} min temu`;
  }
  if (ms < DAY) {
    const n = Math.floor(ms / HOUR);
    return `${n} godz. temu`;
  }
  if (ms < 2 * DAY) return "wczoraj";
  const days = Math.floor(ms / DAY);
  if (days < 7) return `${days} ${plPlural(days, "dzień", "dni", "dni")} temu`;
  if (days < 31) {
    const n = Math.floor(days / 7);
    return `${n} tyg. temu`;
  }
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} mies. temu`;
  const years = Math.floor(days / 365);
  return `${years} ${plPlural(years, "rok", "lata", "lat")} temu`;
}
