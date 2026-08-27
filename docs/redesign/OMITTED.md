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

### B8 Podsumowanie
- **„+3 w tym tygodniu"** pod kaflem Ukończone — nigdzie nie ma znacznika czasu ukończenia
  zadania; `updatedAt` kłamie. Podwiersz wycięty.
- **„WIP limit 5"** pod kaflem W toku — `StatusColumn` nie ma pola limitu.
- **Link „Wszystko"** przy Ostatniej aktywności — nie istnieje trasa z aktywnością tablicy.
- **Definicja „W toku"** — schemat nie zna semantyki kolumn; reguła to nazwa kolumny
  (`w toku|w trakcie|in progress|doing|realizacja`), a w zapasie „ma status, nie pierwsza
  kolumna, nie ukończone". Zaasertowane w `components/summary/aggregate.check.ts`.

### B11 Opis
- **„wersja 12" / „Historia wersji"** — brak wersjonowania w schemacie (D7). Zamiast tego
  „ostatnia zmiana" z ostatniego wpisu `board.overview.updated` w `AuditLog`.
- **Tytuł dokumentu 24px z makiety** — nie jest nazwą tablicy i nie ma pola; użytkownik
  wpisuje własny nagłówek w treści.
- **Menu slash („/")** — placeholder obiecuje, ale menu bloków nie istnieje; zaimplementowany
  jest sam tekst placeholdera (tego wymaga AK117).
- **Wstawianie obrazu** działa przez URL (`window.prompt`) — dokumenty tablic nie mają akcji
  uploadu, a faza nie dokłada server actions.

### B4 Tablica (kanban)
- **Limit WIP i zwinięcie kolumny** zapisują się w `localStorage` (`ui:kanban:<boardId>`) —
  `StatusColumn` ma tylko `id/boardId/name/colorHex/order/createdAt`, a akcje zapisu prefów są
  zamknięte Zodem na klucze widoku TABLE. Skutek: limit ustawiony przez jedną osobę nie jest
  widoczny dla zespołu. Ścieżka wyjścia: pole `StatusColumn.wipLimit` + rozszerzenie akcji.
- **Stan toolbara kanbana** (szukaj/osoba/priorytet/grupowanie/sortowanie) jest sesyjny z tego
  samego powodu — D16 („zapis w `BoardView.configJson`") wymagałby akcji świadomej kanbana.
- **Drag & drop w trybie swimlane** — karty są tam tylko do odczytu, zgodnie z makietą
  `B4-tablica-swimlane` (nowy tryb, więc nie ma czego regresować).
- **Chevrony kolejności kolumn** zniknęły z nagłówka kanbana (makieta ich nie ma). Sama funkcja
  została — `reorderStatusColumnsAction` obsługuje picker statusu (`components/table/status-picker.tsx`).
- **Mobilny „Utwórz zadanie"** otwiera wspólny `CreateTaskDialog` bez wstępnie wybranej kolumny —
  dialog nie przyjmuje `statusColumnId`.

### B5 Oś czasu
- **Toolbar z makiety** (`Szukaj na osi`, `Milestone ▾`, `Kategoria statusu ▾`) — nie zbudowany:
  to wspólny `BoardToolbar` z zapisem w `BoardView.configJson` (D16), a „Kategoria statusu"
  nie ma pola w `StatusColumn`.
- **Szerokość osi na mobile** jest stała (420px), nie wyliczana z danych — AK102 przypina
  wewnętrzną szerokość do 560px, co jest deterministyczne tylko przy stałej osi. Skutek:
  na mobile zoom zmienia wyłącznie pasma nagłówka.

### B6 Roadmapa
- **„Gotowe" bez wsparcia schematu** — `StatusColumn` nie ma `isDone`, więc `doneStatusIds()`
  rozpoznaje po nazwie, a w zapasie bierze ostatnią kolumnę wg `order`. Ta sama reguła co
  w `/my-tasks` i w Podsumowaniu.
- **Opis milestone'u to zwykły `Textarea`, nie Tiptap** — makieta rysuje zwykłe pole, a stary
  dialog montował edytor z `initial={null}` i **kasował opis przy każdym zapisie**. Teraz treść
  robi rundę przez `docToText`/`textToDoc`; ewentualne formatowanie spłaszcza się do linii.

### B7 Kalendarz
- **„Dodaj zadanie na <data>"** to inline quick-add (tworzy zadanie i ustawia `startAt` na 09:00
  tego dnia), a nie `CreateTaskDialog` z wstępną datą — dialog nie przyjmuje daty domyślnej.
- **Zadania z samym terminem** — przeciągnięcie przesuwa całe zadanie; przy braku `startAt`
  patchowany jest sam `stopAt` (nie wymyślamy daty startu).
- **Filtry Status/Osoba w kalendarzu są lokalne**, nie lądują w `BoardView.configJson` (D16).

### B9 Whiteboard / B10 Linia zadań
- **Toolbar ma 2 pozycje więcej niż makieta** — „Zapisz" (zapis jest jawny, bez autozapisu,
  więc bez przycisku nic nie przetrwałoby reloadu) i „⋯" (karta zadania, obraz, szablony,
  eksport PNG, minimapa — narzędzia, których makieta nie pokazuje).
- **AK112 mówi o 8 narzędziach, makieta rysuje 7 pigułek** — dołożony „Romb" (istniejące
  narzędzie silnika), czyli jedno pole 32px różnicy względem PNG.
- **Kropki siatki nie panują z widokiem** — AK112 wymaga CSS-owego `backgroundImage`
  zamiast `<Background/>` React Flow, więc siatka jest statyczna względem kontenera.
- **Pula zadań** Linii zadań to teraz panel spod ⋯, nie stały sidebar (makieta B10 go nie ma).
- **Przeniesienie karty między etapami** to `removeFromFlowAction` + `appendTaskToFlowAction` —
  akcji „przenieś" nie ma, a faza nie dokłada server actions. Karta ląduje na końcu etapu.

## F4 — D1 Powiadomienia

- **Przycisk „Odpowiedz” na karcie powiadomienia** — makieta D1 pokazuje szybką odpowiedź
  z poziomu skrzynki; backend jej nie ma (`createCommentAction` wymaga kontekstu zadania,
  a `Notification.payload` nie niesie wątku). Wypisane wprost w MAP D7 („szybka odpowiedź
  z powiadomienia”). Zostaje sam „Otwórz zadanie”, który otwiera modal 960 z kompozytorem.
- **Typ powiadomienia „Termin … minął”** i „Wszystkie podzadania ukończone” z makiety —
  nikt takich rekordów nie tworzy (`Notification.type` to dziś `comment.mention`,
  `task.assigned`, `task.created`, `task.status.changed`, `poll.created`, `support.*`).
  Zamiast osobnej karty: każde powiadomienie o zadaniu z minionym terminem pokazuje
  czerwoną etykietę „termin: …”, a „Przesuń termin” jest przy każdym zadaniu z terminem.
- **„Przesuń termin”** to menu z presetami (Jutro / Za 3 dni / Za tydzień) liczonymi od
  bieżącego `stopAt` — woła istniejące `patchTaskAction`. Pełny picker daty wymagałby
  zagnieżdżenia popovera w popoverze.
- **Ikona ⚙ w nagłówku** jest triggerem menu (Usuń przeczytane / Ustawienia powiadomień →
  `/profile`); nie ma osobnego ekranu ustawień powiadomień.
- **Wyciszanie wzmianki `@Nick` w cytacie** — snippet zapisany jest jako czysty tekst,
  więc cytat nie podświetla wzmianki tak jak makieta.
- **Zakładka jest stanem lokalnym** (bez `?tab=` w URL) — nic tego nie utrwala i AK134
  tego nie wymaga.

## F4 — przestrzeń + osobiste

### D2 Zadania dla Ciebie / D3 TO DO
- **Filtry `/my-tasks` schowane w popoverze** — makieta D2 nie ma paska filtrów, ale wyszukiwarka,
  filtr tablic i sortowanie nie mogą zniknąć; parametry URL bez zmian.
- **Drzewo list/folderów TO DO w popoverze** przy tytule (makieta D3 nie ma lewej kolumny),
  panel szczegółów jako prawy sheet 420px.
- **Ikona „przenieś" przesuwa termin na jutro** — nie ma akcji przenoszącej `TodoItem` między
  listami, a faza nie dokłada server actions.
- **„Ukończone dziś" liczy się po `updatedAt`** — schemat nie ma `completedAt`.
- Nazwy kubełków `/my-tasks` zmienione na zgodne z makietą (Po terminie / Ten tydzień / Później);
  `e2e/10-my-tasks.spec.ts` zaktualizowany w tej samej zmianie.

### D4 Kalendarz osobisty
- **Sekcja „Widoczne w kalendarzu" jest w kolumnie strony, nie w globalnym pasku bocznym** —
  makieta wkłada ją do paska nawigacji, co wymagałoby kontekstowych sekcji w shellu.
- **Fioletowe pigułki „spotkania" pominięte** — nie ma encji spotkania przypiętej do osoby
  (`WorkspaceEvent` jest w zakresie przestrzeni i renderuje się na kalendarzu przestrzeni).
- Godziny spoza 08:00–20:00 przyklejają się do pierwszego/ostatniego wiersza; etykieta pigułki
  zawsze pokazuje prawdziwą godzinę.

### D1 Powiadomienia
- Kubełki „Dzisiaj"/„Wczoraj" liczone w stałej strefie `Europe/Warsaw` (`INBOX_TZ`), żeby SSR
  w kontenerze na UTC nie rozjeżdżał się z hydracją.

### E4 Urlopy / D5 przemalowanie
- **Limit urlopu to stała `ANNUAL_LEAVE_DAYS = 26`** — nie ma kolumny z wymiarem per osoba.
- **Grafik zespołu pokazuje bieżący miesiąc i maksimum 8 osób** (reszta jako „+N osób"), żeby
  duży zespół nie wypychał stopki poza ekran.
- **`/w/<id>/settings` nie ma edytora `enabledViews`** — `updateWorkspaceAction` nigdy tego pola
  nie przyjmowała (stan zastany, nie regresja).
- **`/profile` nie ma sekcji „Sesje"**, więc kotwica `#sessions` w menu awatara nie prowadzi nigdzie.
- Wybór odbiorcy przypomnienia to natywny `<select>` zamiast popovera z awatarami i wyszukiwarką.

### AK142 — wysokości kontrolek
- **Pływający przycisk Ateron ma 58px**, poza listą 28/32/36/44. To celowe: check wyznacza
  podłogę dla stref trafienia, a FAB jest z założenia większy. Wszystkie pozostałe przyciski
  na sześciu ekranach D5 mieszczą się w dozwolonych wysokościach.

## F5 — narzędzia

### E2 Czas pracy
- **„cel 40h" i chipy „plan:"** — nie ma pola z planem ani celem tygodniowym.
- **`fakt.` jest tylko do odczytu** — `billable` da się ustawić wyłącznie przy tworzeniu wpisu;
  nie ma `updateTimeEntryAction`, a faza nie dokłada server actions.
- **Właściciel timera wnioskowany, nie zapisany** — `Task` ma `timerStartedAt`, ale nie ma
  kolumny z osobą; kafel „Timer aktywny" czyta ostatni wpis `task.timerStarted` z `AuditLog`.
- **Kolumny weekendu** pojawiają się tylko, gdy ktoś w nie zalogował czas — makieta rysuje
  pon–pt, ale ukrywanie soboty gubiłoby zapisany czas.

### E3 Notatnik
- **Pasek formatowania** — makieta go nie ma, a `RichTextEditor` wystawia go tylko w wariancie
  z ramką formularza. Formatowanie działa skrótami i regułami wejścia.
- **„Udostępnij" kopiuje link, nie udostępnia** — `Note` nie ma modelu współdzielenia
  (`BoardShareLink` dotyczy tylko tablic). Stopka mówi „notatka prywatna".
- **Chip przy notatce to nazwa folderu** — notatki nie mają tagów, więc chipy `sprint`/`klient`
  z makiety nie mają źródła danych. Z tego samego powodu nie ma stosu awatarów.
- **„Foldery" to kolumna strony, nie sekcja paska bocznego** — tak samo jak filtry kalendarza
  w D4 przed przeniesieniem; do zrobienia przez `sidebar-slot`, gdy będzie potrzeba.

### E5 Subskrypcje
- **Odnowienie, Płatnik, Karta, Nieużywane** — brak pól w schemacie.
- **Status zawsze „Aktywna"** — jedyny stan, jaki `Subscription` ma, to `deletedAt`, a wiersze
  skasowane nie są w ogóle pobierane.
- **Notatka edytowana z menu wiersza**, nie drugim inputem — dwa inputy w wierszu 44px nie
  zmieszczą się obok siebie z zachowaniem 24px strefy trafienia.

### E6 Hasła
- **„2FA wyłączone" i „Dziennik audytu"** — nie ma per-wpisowego 2FA ani widoku audytu sejfu.

### E7 Plan sprzedaży
- **„% szansy" i „Cel Q3"** — `Deal` nie ma pola prawdopodobieństwa, a przestrzeń nie ma celu
  kwartalnego.

### E8 Creative Board
- **Głosowanie na pomysły** — brak modelu głosów.

### E9 Support
- **SLA** — nie ma pól czasu reakcji ani terminu rozwiązania.

### E10 Wiki
- **Drzewo stron** — backend trzyma jedną stronę per przestrzeń, więc panel pokazuje jeden
  korzeń zamiast drzewa.
- **Historia wersji** — brak wersjonowania (ta sama przyczyna co w B11 Opis).

## F5 — E7 / E8 / whiteboardy / panel admina (B5)

### E7 Plan sprzedaży
- **„Wygrane Q<n>" liczy się po `expectedCloseAt`**, a gdy pole jest puste — po `updatedAt`.
  `Deal` nie ma `closedAt` (D7), więc kafel nie zna prawdziwej daty wygranej. Ścieżka wyjścia:
  kolumna `Deal.closedAt` ustawiana w `moveDealAction`.
- **Kafel „Najbliższy krok" wchłonął moduł przypomnień** (F12-K70/K71): pierwszy wiersz na
  kaflu, cała lista w popoverze. Makieta ma dokładnie trzy kafle, a osobna sekcja
  „Nadchodzące przypomnienia" byłaby czwartym blokiem spoza makiety —
  `components/sales/sales-reminders-tile.tsx` skasowany, funkcja została.
- **„ważone: N tys." pod kaflem „W pipeline"** — wartość ważona wymaga „% szansy", która
  jest pominięta.
- **Zakładka „Prognoza"** (makieta pokazuje tylko „Pipeline") to tabela na wspólnym
  `DataTable`: etap / liczba dealów / wartość / najbliższe zamknięcie. Bez prognozy
  ważonej, z tego samego powodu co wyżej.
- **Suma etapu przy wielu walutach** jest listą kwot rozdzieloną kropką („12 tys. zł ·
  2 tys. EUR") — nie przeliczamy kursów.
- **Mobile** (brak makiety) zostaje jednoetapowym widokiem ze swipem; drag&drop tylko na
  desktopie.

### E8 Creative Board
- **Chip kategorii** — `CreativeBrief` nie ma kategorii, więc jedyny chip na karcie to status
  (Szkic / W recenzji / Zatwierdzony / Zarchiwizowany). Podpis pod tytułem ekranu skrócony do
  „pomysły zespołu" (bez „głosujcie kropkami"), stopka bez „głosowanie: kropki 3/os",
  kafel przerywany bez „3 głosy na osobę".
- **Segmenty** mapują cztery statusy na trzy zakładki: Najpopularniejsze = otwarte
  (IN_REVIEW przed DRAFT, potem najświeższa zmiana), Najnowsze = otwarte wg daty utworzenia,
  Zrealizowane = APPROVED + ARCHIVED. Reguła zaasertowana w
  `components/briefs/brief-segments.check.ts`.
- **Powiązanie pomysł → zadanie idzie po tytule.** „Zrób zadanie" tworzy zadanie o tytule
  pomysłu (istniejące `createTaskAction`), a lista pokazuje „→ zadanie #ID" dla zadania
  o dokładnie tym samym tytule. Schemat nie ma relacji brief↔task (D7), więc dwa obiekty
  o identycznym tytule skleją się fałszywie. Ścieżka wyjścia: `CreativeBrief.taskId`.
- **Zadanie ląduje na pierwszej tablicy przestrzeni** — `createTaskAction` wymaga `boardId`,
  a makieta ma jeden przycisk bez wyboru tablicy. Brak tablic albo brak prawa `task.create`
  → przycisk się nie pojawia.
- **Opis na karcie** to tekst pierwszego akapitu dokumentu (nagłówki szablonu pomijane) —
  `briefExcerpt` w `brief-segments.ts`.

### Whiteboardy (AK170)
- **Lista bez makiety (D5)** — przemalowana prymitywami: karty 3 kolumny, nazwa edytowana
  w miejscu (`EditableTitle` → `renameCanvasAction`), usuwanie z potwierdzeniem, tworzenie
  w popoverze. `components/canvas/new-canvas-form.tsx` i `delete-canvas-button.tsx`
  skasowane — używała ich wyłącznie ta lista.

### Panel admina (AK150)
- **Tabele na wspólnym `DataTable`** (użytkownicy, przestrzenie, audyt, akcje admina,
  backupy): nagłówek 32px sticky, wiersze 44px przez `[--row-h:44px]`.
- **Audyt na wąskim ekranie** zostaje listą kart — sześć kolumn nie mieści się w 390px.
- **Pasek filtrów obu logów** to jeden komponent (`components/admin/audit-filters.tsx`)
  z natywnym `<select>` okresu: formularz jest bezskryptowym GET-em, a `Select` z base-ui
  wymaga klienta.
- **Nawigacja admina** scalona w `components/admin/admin-nav.tsx` (pasek + sheet);
  `desktop-sidebar.tsx`, `admin-mobile-nav.tsx` i `admin-nav-item.tsx` skasowane.
- **Dodane potwierdzenia** przy pojedynczych akcjach (ban/unban, super admin, usunięcie
  konta, przywrócenie i trwałe skasowanie przestrzeni, backup wszystkich) —
  `components/admin/confirm-submit.tsx`. Nic nie zostało poluzowane: `requireSuperAdmin()`
  zostaje w layoucie, na każdej stronie i w każdej akcji.
- **Zbiorczy reset haseł** dalej wyłączony (brak kanału dostarczenia hasła) — stan zastany.

### E6 Hasła — etykieta szyfrowania
- Makieta pisze **„Szyfrowane E2E"**, ale `lib/vault-crypto.ts` szyfruje w bazie
  (AES-256-GCM) i sam w komentarzu zaznacza, że to **nie** jest end-to-end — serwer widzi
  hasło w momencie szyfrowania i odszyfrowania. Chip mówi więc „Szyfrowane w bazie",
  z wyjaśnieniem w `title`. Obiecywanie E2E tam, gdzie serwer ma dostęp do haseł, byłoby
  fałszywą deklaracją bezpieczeństwa.
- **`VAULT_KEY` nie było w `.env`**, więc sejf nie potrafił nic zapisać ani odczytać na
  stagingu (`encrypt()` rzuca poniżej 32 znaków klucza). Dodany klucz lokalny; zmienna
  jest teraz opisana w `.env.example`. Produkcja ma swój klucz w Coolify — jego utrata
  oznacza bezpowrotną utratę danych sejfu.
