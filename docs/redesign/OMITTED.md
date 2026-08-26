# OMITTED — świadome pominięcia w redesignie v5

## Stan po F2 (B5: Lista, 2026-08-26)

Zrobione z listy F1 → F2: wspólny stan Listy (`components/table/list-state.tsx`) zasila `BoardToolbar` (search, stos awatarów = filtr „Przypisany”, Status/Priorytet/Tag, „+ Filtr” builder, chipy + Wyczyść, Grupuj, Sortuj, Kolumny, ⋯ Import/Eksport/Kopiuj link); `table-toolbar.tsx`, `table-filters-toolbar.tsx` i `mobile-filters-drawer.tsx` skasowane; wiersze czytają `--row-h` (gęstość działa).

Świadomie pominięte / uproszczone w Liście:

- **Sortowanie wielokolumnowe** — `saveTableFiltersAction` przyjmuje jedno `sort`; Lista sortuje po jednej kolumnie (jak dotąd). Wielokrotne = zmiana akcji + schematu configJson.
- **Operator „w zakresie” (daty)** — `lib/table-filters.ts` ma 19 operatorów bez `between`; zakres = dwa warunki („po” + „przed”). Builder pokazuje dokładnie 19 operatorów z lib (etykiety UI: „jest / nie jest / zawiera / jest puste…”).
- **Filtry priorytet/przypisany/tag** nie mają własnych `TableFilter.kind` — Lista koduje je jako `SINGLE_SELECT`/`MULTI_SELECT` na kolumnach `priority`/`assignees`/`tags` (persist bez zmian w akcjach).
- **Config filtrów/kolumn dla widoków custom** — `saveTableFiltersAction`/`saveTableColumnPrefsAction` zawsze piszą do domyślnego widoku TABLE (`name: null`); custom widoki TABLE czytają własny `configJson`, ale zapis ląduje w domyślnym (pre-existing, wymaga `viewId` w akcjach).
- **Bulk „Tag”** — brak akcji zbiorczej; pasek woła `toggleTagAction` per zadanie (ok dla dziesiątek zaznaczeń).
- **Kolumna „Budżet” z makiety B1** — brak pola w schemacie; Σ w nagłówku grupy liczy się dla każdej kolumny custom typu NUMBER (na stagingu dodana kolumna „Budżet” NUMBER/PLN).
- **Hover-akcje wiersza (⋯ przy tytule w makiecie)** — pominięte; menu wiersza = panel zadania, zaznaczenie = pasek zbiorczy.
- **Przywracanie scrolla po zamknięciu panelu (K138)** — od F1 scrolluje `<main>`, nie `window`; `RouteTracker` zapisuje `window.scrollY` (zawsze 0). Lista trzyma własny kontener scrolla, więc pozycja i tak zostaje przy intercepting route; pełne odtworzenie po `router.push` wymaga zmiany `RouteTracker` (F6).
- **Import w menu ⋯** — klika przycisk `ImportTasksDialog` z nagłówka (B7); brak przycisku (flaga off) = toast.
- **Mobile**: brak inline „+ Dodaj zadanie” — dolny przycisk otwiera dialog B3 (`CreateTaskDialog`); pickery w kartach niedostępne (edycja w panelu zadania).
- **Zmiana typu pola z menu nagłówka** zachowuje dotychczasowe `options` (bez konwersji wartości) — jak w gear-popoverze „Kolumny”.
- **Toolbar na Tablicy / Osi czasu / Kalendarzu** — nadal tylko Lista (D16 → F3).

## Do podłączenia w F2 (stan po F1, historycznie)

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

## F2 — B2 panel zadania (B6, 2026-08-26)

- **Budżet** w prawej kolumnie (B2 wszystkie warianty) — Task nie ma pola budżetu (D7), wiersz pominięty.
- **Kanał** — makieta pokazuje go jako przykład pola dodatkowego; renderujemy realne `customColumns` tablicy pod etykietą „Pola dodatkowe" (gdy tablica nie ma kolumn: „Brak").
- **Chip statusu przy powiązanych zadaniach** — `lib/task-fetch.ts` (read-only w F2) nie zwraca statusu linkowanych zadań; wiersz ma #ID, tytuł, awatar przypisanego.
- **Kontakt** — pole ukryte całkowicie (klient wyciął je w F12-K67, `workspaceContacts` puste); `ContactField` usunięty z `task-detail.tsx`.
- **„Zaktualizowano · osoba"** — Task nie ma `updatedById`; pokazujemy aktora ostatniego wpisu AuditLog (może być pusty).
- **Reakcje / „Odpowiedz" przy komentarzach** — stary stub bez backendu usunięty (nie ma go w B2).
- **Konflikt wersji** — `patchTaskAction` nie przyjmuje `version`, więc nie ma twardego optimistic-locka po stronie serwera. Baner „Ktoś zmienił to zadanie — odśwież" pojawia się gdy (a) realtime/refresh przyniesie nowszą `version` niż ta, z której karta była renderowana (własne zapisy są rozpoznawane), (b) zapis tytułu z nieaktualnej karty jest blokowany po sprawdzeniu `readTaskMeta`. Pełny lock = zmiana akcji (poza F2).
- **Prawa kolumna panelu 600** — B2-panel ma 204px białą kolumnę z separatorem `n-100` (nie 300 `canvas` jak modal/pełna strona); wdrożone 1:1 z PNG.
- **Wariant modal (⌘K / powiadomienia)** — `command-palette.tsx` i `inbox-hotkey-wrapper.tsx` kierują na `/w/<ws>/t/<id>?mode=modal` (zamiast `…/table?task=<id>`); jedyna zmiana w plikach spoza `components/task/**`.
- **`components/task/status-hue.ts`** — `hueForColor(hex): ChipHue` (HSL → 12 odcieni chipów). B5 ma zrobić to samo w `components/table/status-hue.ts` → do deduplikacji przez integratora.
- **Mobile** — sekcje Załączniki / Powiązane / Głosowanie oraz wszystkie wiersze Szczegółów są renderowane (B2-mobile pokazuje tylko wycinek); tab „Czas pracy" zostaje też na mobile.

## F3 — widoki tablicy

- **Tło tablicy (AK120)** — `Board` nie ma kolumny na kolor, a F3 nie zmienia schematu
  (MAP: „bez zmian schematu"). Wybór z menu ⋯ → Tło zapisuje się w `localStorage`
  (`flovly:boardBg:<boardId>`), więc działa per urządzenie, nie per tablica dla całego
  zespołu. Ścieżka wyjścia: kolumna `Board.backgroundColor` + server action —
  podmienia się dwie funkcje w `components/view/board-header-menu.tsx`.
