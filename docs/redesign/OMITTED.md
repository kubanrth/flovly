# OMITTED — świadome pominięcia w redesignie v5

## Do podłączenia w F2

Stan po F1 (B4: nagłówek tablicy / tabsy / toolbar / dialog nowego widoku, 2026-08-26):

- **BoardToolbar na Liście** (`components/view/table-toolbar.tsx`) rozmawia z `BoardTable` przez zdarzenia `window` (`flovly:board-search`, `flovly:board-add-filter`). F2 przenosi filtry/sort/grupowanie do wspólnego stanu i kasuje ten plik oraz listener w `components/table/board-table.tsx` (blok „F1 hookup").
- **Chipy filtrów w toolbarze** (`chips`/`onClearChips`) — puste; aktywne filtry nadal pokazuje stary `TableFiltersToolbar` pod nagłówkiem. F2: zasilić `chips` ze stanu Listy i usunąć stary pasek.
- **Priorytet ▾ / Tag ▾** — wyłączone (`disabled`), bo `TableFilter.kind` nie ma rodzaju priorytet/tag. F2 dodaje te rodzaje w `lib/table-filters.ts` i podpina przyciski.
- **Grupuj ▾ / Sortuj ▾ / Kolumny** — wyłączone na Liście (brak `onGroup`/`onSort`/`onColumns`); stare pickery działają w pasku `BoardTable`. F2 podpina do nowej tabeli.
- **Stos awatarów jako filtr osoby** (`onTogglePerson`) — na Liście tylko wyświetla członków; F2 podpina filtr „Przypisany".
- **Toolbar na Tablicy / Osi czasu / Kalendarzu** — `BoardHeaderServer` przyjmuje `toolbar`, ale tylko `table/page.tsx` go przekazuje. F2+ dodaje na pozostałych widokach (D16).
- **Gęstość** zapisuje `localStorage['ui:density']` i `<html data-density>`; stara `BoardTable` nie czyta `--row-h` — wiersze zmienią wysokość dopiero w nowej Liście (F2, `DataTr`).
- **Dialog nowego widoku (B12)**: pole „Widoczność" jest `disabled` z wartością „Cały zespół" (BoardView nie ma kolumny widoczności); checkbox „Przenieś filtry z bieżącego widoku" pominięty (`createBoardViewAction` nie przyjmuje filtrów). Oba wymagają zmian w akcjach/Prismie (poza F1).
- **Kafle „Opis" i „Podsumowanie"** w dialogu są `disabled` — nie są typami `BoardView` (Opis = `/overview`, zawsze jeden na tablicę; Podsumowanie = B8, brak trasy).
- **Tab „Podsumowanie"** w pasku widoków jest `aria-disabled` z tooltipem „Wkrótce" — trasa B8 powstaje w późniejszej fazie.
- **⋯ przy widokach custom**: tylko „Usuń widok" — nie ma akcji zmiany nazwy widoku (`renameBoardViewAction` nie istnieje). Do dodania razem z akcją.
- **Opis tablicy** (`board.description`) nie jest już renderowany w nagłówku (A2 go nie ma) — pozostaje w widoku Opis.
