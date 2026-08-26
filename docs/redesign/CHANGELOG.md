# Redesign v5 — changelog

## F1 — Fundament (2026-08-26)
- Tokeny v5 (`app/globals.css`, light only), Inter + JetBrains Mono, znak marki (kula), favicon/OG.
- Usunięty dark mode, Onest, glass/aura/gradienty, fioletowa paleta, stare logo.
- `components/ui/*` przepisane (36 prymitywów + `icons.tsx` z makiet), podgląd `/dev/ui`.
- Nowy shell: `AppFrame` = top bar (48px, Utwórz, skróty, menu awatara z gęstością) + sidebar (240/56/drawer, Ostatnie/Gwiazdka, Dostosuj pasek) + `RouteFrame`.
- Board header: breadcrumb, tabsy podkreślane z „Więcej N", toolbar, dialog nowego widoku (B12).
- `next.config`: `images.remotePatterns` dla Supabase (przegląd przestrzeni padał na avatarach).
- Lint: 171 → 0 błędów (przed redesignem było 171); e2e zaadaptowane do nowych selektorów.

## F2 — Lista + panel zadania (AK40–AK80)

- `components/table/board-table.tsx` przepisany na v5 (1949 → ~830 linii); wydzielone:
  `list-state.tsx`, `list-toolbar.tsx`, `grouping.ts`, `bulk-bar.tsx`, `mobile-list.tsx`,
  `filter-builder.tsx`, `columns.ts`, `field-icons.tsx`, `add-column-form.tsx`,
  `list-config.ts`, `selection.ts`. Usunięte: `table-filters-toolbar.tsx`,
  `mobile-filters-drawer.tsx`.
- Panel zadania (B2) jako 600px side sheet na przechwytującym route, bez scrimu.
- Self-checki: `npx tsx components/table/list.check.ts`, `components/ui/status-hue.check.ts`.

### Naprawione w pętli krytyka
- **AK44** — Shift+klik nie zaznaczał zakresu. Dwie przyczyny: base-ui redispatchuje
  klik na ukrytym `input` (handler leciał 2×) → przeniesione na `onCheckedChange`;
  oraz `lastClicked.current` był nadpisywany, zanim React uruchomił leniwy updater
  `setSelection` → kotwica czytana przed setterem. Logika wyniesiona do
  `selection.ts::nextSelection` + asercje w `list.check.ts`.
- **AK63** — panel otwierał się w 417–462 ms, bo klik w tytuł czekał 220 ms na
  ewentualny dwuklik. Opóźnienie usunięte (dwuklik dalej wchodzi w edycję —
  panel nie zasłania zamrożonej kolumny). Po zmianie 199–218 ms.
- **AK74** — Lista scrolluje własny kontener, nie `window`, więc `TaskModalShell`
  nie miał czego przywracać. Pozycja zapisywana per tablica w `sessionStorage`
  (`flovly:listScroll:<boardId>`) i przywracana z ponowieniami.
- **Bug produkcyjny** (poza AK): fałszywy konflikt wersji w `task-detail.tsx`
  po cichu gubił zapisy tytułu — porównanie do `seenVersion + selfMutations`.
- **Bug produkcyjny** (poza AK): `/my-tasks` wrzucało ukończone zadania do
  „Zaległe" na tablicach z kolumnami dodanymi po „Done" — dołożone rozpoznawanie
  po nazwie kolumny.
- `e2e/reset-fixtures.ts` — reset `configJson` widoków TABLE + parkowanie zadań
  w kubełkach `/my-tasks`; wołany w `auth.setup.ts` i w `beforeAll` speców 05/06/13.

### Ujednolicenie reguły „ukończone" (F3)
Reguła żyła w czterech kopiach, dwie z nich różniły się semantycznie. Teraz jedno źródło:
`components/board/done-status.ts` (+ self-check). Zasada: jeśli tablica ma kolumnę o nazwie
brzmiącej jak „gotowe", liczy się tylko ona; dopiero przy jej braku liczy się ostatnia kolumna
wg `order`. Poprzednio ostatnia kolumna liczyła się ZAWSZE, więc na tablicach z kolumnami
dopisanymi po „Done" (np. `Done:3, FAZA-2030:4`) zadania z ostatniej kolumny były raportowane
jako ukończone. Podpięte: `/my-tasks`, licznik w pasku bocznym, Podsumowanie tablicy, Roadmapa.
`components/profile/dashboard-tiles.tsx` celowo zostaje przy swoim luźnym dopasowaniu —
to inny kontekst (kafle profilu w wielu przestrzeniach).

### F3 — poprawki po krytykach
- **AK105** — zapis milestone'u był widoczny po 0,9–1,4 s. React trzyma tranzycję akcji
  formularza otwartą do końca rundy do serwera, więc optymistyczny echo-patch nie mógł się
  scommitować wcześniej. Edycja wysyła formularz ręcznie, poza tranzycją → 3–7 ms.
- **AK115** — do Linii zadań **nie dało się dodać zadania**: pula ustawiała
  `effectAllowed = "copy"`, kolumna etapu odpowiadała `dropEffect = "move"`, a Chrome przy
  takim rozjeździe anuluje `drop`. Zgodne wartości + `data-ui="taskline-column"`.
- **AK119** — milestone utworzony w custom widoku ROADMAP pokazywał się w domyślnej Roadmapie:
  domyślne trasy `roadmap` i `gantt` pobierały milestone'y bez `boardViewId: null`.
- **AK111 / AK118 / AK97** — stopki nie trzymały się dołu ekranu (Podsumowanie kończyło się
  na 760px, stopka kanbana lądowała na y=5809, pole edycji Opisu miało 21px wysokości).
  Łańcuch flex był przerwany w trzech miejscach: `<main>` było blokiem, layout przestrzeni
  blokiem, `BoardShell` bez `min-h-0`. Kalendarz dodatkowo miał podłogę wiersza 112px,
  przez którą 6-tygodniowy miesiąc wypychał stopkę poza ekran.
- Pływający przycisk Ateron zasłaniał „Zwiń wszystkie milestone'y" na Osi czasu i „−"
  w zoomie whiteboardu — oba klastry odsunięte o szerokość przycisku.
- Zakładka aktywnego widoku pokazuje się nawet wtedy, gdy przestrzeń ma ten widok wyłączony
  (wcześniej URL działał, ale żadna zakładka nie była aktywna).
- `e2e/reset-fixtures.ts` sprząta po poprzednich przebiegach: tablice `e2e-board-*`/`KRYTYK-*`
  i zadania o nazwach tworzonych przez testy. Bez tego tablica testowa urosła z 6 do 142 zadań
  i Lista przestawała się mieścić w 5-sekundowym limicie, wywracając niepowiązane testy.

### F3 — druga runda krytyka
- **Tworzenie custom widoku Whiteboard kończyło się ekranem błędu** w ~2 na 3 próby.
  Kanwa powstaje leniwie przy pierwszym wejściu, a pierwsze wejście renderuje się więcej
  niż raz (prefetch + nawigacja) — oba przebiegi widziały „brak kanwy” i wchodziły w `create`,
  przegrany łapał unikalność `(boardId, kind)`. `upsert` tego nie zamyka: z `include` Prisma
  robi read-then-write. Rozwiązanie: `components/canvas/create-once.ts` (+ self-check),
  użyte w trzech miejscach, które tworzyły kanwę leniwie.
- **Przenoszenie karty między etapami mogło ją skasować bezpowrotnie.** Sekwencja była
  „usuń + dopnij”; gdy dopięcie zawiodło (np. karta wskazywała skasowane zadanie), węzeł
  już nie istniał i karta znikała bez komunikatu. Teraz „dopnij + usuń”, z komunikatem
  przy każdym niepowodzeniu.

## F4 — przestrzeń + osobiste (AK130–AK145)

- **C1 Przestrzeń** przepisana: kafel-litera, meta, tabsy, karty tablic z paskiem postępu
  i „N po terminie", kafel „Nowa tablica", ostatnia aktywność, stopka.
- **D1 Powiadomienia**, **D2 Zadania dla Ciebie**, **D3 TO DO**, **D4 Kalendarz osobisty**
  (widok tygodnia z kolumną godzin i linią „teraz"), **E4 Urlopy** — wszystkie wg makiet.
- **D5**: przemalowane `/my/reminders`, `/profile`, `/workspaces`, `/w/<ws>/settings`,
  `/w/<ws>/members`, `/w/<ws>/calendar`.

### Naprawione przy okazji
- **Checkbox miał 16px obszaru klikalnego** — poniżej minimum WCAG 2.5.8 (24px). Prymityw dostał
  niewidoczny obszar 24px przez pseudoelement, więc ekrany nie muszą już podmieniać go na
  natywny input, żeby przejść audyt wysokości kontrolek.
- **Padding `RouteFrame` obchodzony ręcznie w dziewięciu plikach** ujemnymi marginesami
  zsynchronizowanymi z jego wartościami — jedna zmiana paddingu i wszystkie pękają. Trasy
  pełnoekranowe dopisane do `FULL_BLEED`, marginesy usunięte.
- `#FFF9F5` (kolumna „dzisiaj" z makiet D4/E2) dodany jako token `--today`.
- Usunięte 7 osieroconych komponentów (6 w `components/workspaces/`, `profile-dropdown.tsx`).

### F4 — poprawki po krytykach
- **Wszystkie daty urlopów były przesunięte o dzień.** Picker zapisuje lokalną północ
  (`28 sierpnia` w UTC+2 = `2026-08-27T22:00Z`), a moduł urlopów czyta pola UTC. Skutkiem
  był nie tylko zły napis: `31 sierpnia` stawało się `30 sierpnia`, czyli niedzielą, i wniosek
  po cichu miał **0 dni roboczych**. Data z pickera jest teraz przestemplowana na północ UTC
  tego samego dnia kalendarzowego (`toUtcDateOnly`, self-check w czterech strefach).
- **AK142** — podniesione strefy trafienia poniżej minimum WCAG 2.5.8: rozwijanie tablic
  w pasku bocznym i menu przestrzeni (20/24 → 28px), „+N więcej" w kalendarzu (16 → 28px),
  podpowiedzi Aterona (34 → 36px). Prymityw checkboxa dostał 24px strefę przy zachowanym
  widocznym kwadracie 14–20px.
- **AK141** — filtry „Widoczne w kalendarzu" przeniesione z osobnej kolumny do paska
  nawigacji, zgodnie z makietą, przez `components/layout/sidebar-slot.tsx` (portal do
  `[data-ui=sidebar-slot]`), bez uczenia shellu o trasach.

### Stabilizacja e2e
Suite degradował się z przebiegu na przebieg (50/50 → 46/50 → 48/50, za każdym razem inny test).
Przyczyną nie była losowość, tylko narastające dane: spec importu CSV dokładał 3 zadania na
przebieg (27 sztuk z dziewięciu), a fixture parkował kubełki `/my-tasks` na „najbardziej
zajętej" tablicy — czyli 400-wierszowej pozostałości po krytyku, której testy nigdy nie
oglądają. Fixture wybiera teraz najstarszą niepustą tablicę i sprząta zadania importu;
`openFirstTask` ponawia klik także wtedy, gdy URL się zmienił, a panel nie wstał.
Dwa kolejne pełne przebiegi: 50/50.

### F4 — druga runda krytyka
- **„Otwórz zadanie" z inboxa nie otwierało modala 960**, tylko pełną stronę. Przechwytujący
  route żyje pod `w/[workspaceId]`, więc nie łapie nawigacji z `/inbox` — ale strona zadania
  i tak ignorowała `?mode=modal` i zawsze wymuszała `mode="page"`. Teraz honoruje parametr,
  więc linki z inboxa i z Cmd+K dostają modal bez ruszania przechwytywania (i bez ryzyka dla
  panelu bocznego z F2).
- **AK138 „Ukończone wcześniej"** — klauzula, której krytyk nie mógł wytworzyć, bo dzisiejsze
  ukończenia zawsze trafiają do dzisiejszego kubełka. Zweryfikowana przez zaseedowanie pozycji
  ukończonej 36 h wcześniej: sekcja renderuje się zwinięta („UKOŃCZONE WCZEŚNIEJ · 1")
  i rozwija po kliknięciu.
