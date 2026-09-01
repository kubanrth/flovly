// Po wdrozeniu otwarta karta prosi o nazwy plikow, ktorych juz nie ma na
// serwerze. `reset()` z granicy bledu pobiera dokladnie ten sam, nieistniejacy
// plik — jedynym wyjsciem jest twarde przejscie, ktore bierze swiezy kod.
// Objawialo sie to jako "klikam zadanie, nic sie nie otwiera, trzeba odswiezyc".

const STALE_BUNDLE = /chunk|dynamically imported module|module script failed/i;

export function isStaleBundle(error: Error): boolean {
  return error.name === "ChunkLoadError" || STALE_BUNDLE.test(error.message);
}

/**
 * Przechodzi twardo pod `url` — raz na adres w obrebie karty, zeby nie wpasc
 * w petle, gdyby swiezy kod tez nie wstal. Zwraca `true`, gdy przejscie ruszylo.
 */
export function recoverFromStaleBundle(error: Error, url: string): boolean {
  if (!isStaleBundle(error)) return false;
  const klucz = `stale-bundle:${url}`;
  try {
    if (sessionStorage.getItem(klucz)) return false;
    sessionStorage.setItem(klucz, "1");
  } catch {
    // tryb prywatny bez sessionStorage — lepiej sprobowac raz niz wcale
  }
  window.location.assign(url);
  return true;
}
