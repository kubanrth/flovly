# NAZWA — redesign v5

Statyczne makiety HTML (pliki `.dc.html` — otwierają się bezpośrednio w przeglądarce). Desktop 1440×900, ekrany ★ dodatkowo mobile 390×844. Wszystkie treści po polsku, dane realne (przestrzeń „Projekty AI", tablice „P&R Kickback", „P&R SLOT64", „Sklep Legia"; osoby Daniel, Kuba, Gabryś, Marta).

## Ekrany

### A. Fundament
- [x] `A1-design-system.dc.html` ★ — paleta, typografia, przyciski, pola, wybory, chipy, statusy, priorytety, awatary, tabsy, segmented, breadcrumb, menu, popover, tooltip, dialog, panel, toast, badge, kbd, stany, komórki tabeli, 3 gęstości
- [x] `A1-design-system-mobile.dc.html` ★
- [x] `A2-app-shell.dc.html` ★ — top bar 48 + sidebar 240 + nagłówek tablicy + tabsy 40 + toolbar
- [x] `A2-app-shell-pasek-ikon.dc.html` — sidebar zwinięty do 56 px z tooltipem
- [x] `A2-app-shell-mobile.dc.html` ★ — drawer otwarty nad zawartością
- [x] `A3-menu-i-skroty.dc.html` — menu Utwórz + menu awatara + panel skrótów + dialog „Dostosuj pasek" (wszystkie nakładki na jednym ekranie)
- Dark mode ekranów A2/B1/B2/B4/B5/D1 → sekcja F9

### B. Widoki tablicy
- [x] `B1-lista.dc.html` ★ — sticky nagłówek + zamrożone kolumny (prawdziwy scroll), komórka w edycji, wiersz hover/zaznaczony, menu nagłówka kolumny, builder filtrów + chipy filtrów, pasek akcji zbiorczych, „+ Dodaj zadanie", stopka 128 zadań
- [x] `B1-lista-pogrupowana.dc.html` — grupy wg statusu, liczniki, suma budżetu, grupa zwinięta
- [x] `B1-lista-mobile.dc.html` ★ — karty z tymi samymi polami
- [x] `B2-panel-zadania.dc.html` ★ — panel 600 px, lista pod spodem widoczna; opis w edycji, podzadania 2/5, załączniki + dropzone, powiązane, głosowanie, aktywność + kompozytor, prawa kolumna Szczegóły, date-picker otwarty, baner konfliktu
- [x] `B2-panel-zadania-modal.dc.html` — wariant 960 px + picker osób otwarty
- [x] `B2-panel-zadania-pelna-strona.dc.html`
- [x] `B2-panel-zadania-mobile.dc.html` ★
- [x] `B3-nowe-zadanie-import.dc.html` — oba dialogi (Nowe zadanie · Import CSV/XLSX z mapowaniem kolumn)
- [x] `B4-tablica.dc.html` ★ — kanban, WIP 4/5, karta w przeciąganiu + slot docelowy, kolumna zwinięta
- [x] `B4-tablica-swimlane.dc.html` — Grupuj: Przypisany
- [x] `B4-tablica-mobile.dc.html` ★ — jedna kolumna + przełącznik statusów
- [x] `B5-os-czasu.dc.html` ★ — milestone'y zwinięte (M1–M3, paski zbiorcze)
- [x] `B5-os-czasu-rozwinieta.dc.html` — M1 rozwinięty z 10 dziećmi, przekreślone #ID, chipy statusu, linia „Dziś", uchwyty dat, strzałki zależności, segmented zoomu
- [x] `B5-os-czasu-mobile.dc.html` ★ — poziomy scroll siatki
- [x] `B6-roadmapa.dc.html` — paski milestone'ów z rozwiniętymi zadaniami, przełącznik „Tablica zbiorcza", dialog milestone'a
- [x] `B6-roadmapa-markery.dc.html` — kropki z liczbą zadań + strzałki
- [x] `B7-kalendarz.dc.html` — siatka od poniedziałku, pigułki z paskiem statusu, „+2 więcej", popover dnia, nawigacja
- [x] `B7-kalendarz-mobile.dc.html` ★ — mini-siatka z kropkami + dzień rozwinięty
- [x] `B8-podsumowanie.dc.html` — liczniki (ukończone/W toku/po terminie/budżet), pasek statusów, obciążenie zespołu, milestone'y, aktywność
- [x] `B9-whiteboard.dc.html` — kropkowana kanwa, notatki, ramka przepływu, karta zadania #250, odręczna strzałka, kursor Kuby, toolbar narzędzi, zoom
- [x] `B10-linia-zadan.dc.html` — pipeline 5 etapów (Zgłoszenie→Wdrożone), liczniki etapów, karta zaznaczona, slot upuszczania, „Pokaż starsze"
- [x] `B11-opis.dc.html` — edytor dokumentu tablicy: toolbar formatowania, nagłówki, listy, checklista, callout, załącznik, autosave, historia wersji
- [x] `B12-nowy-widok.dc.html` — picker 9 typów widoków + nazwa, widoczność, przenoszenie filtrów

### C. Przestrzenie
- [x] `C1-przestrzen.dc.html` — nagłówek przestrzeni, karty tablic (postęp, awatary, po terminie), kafel „Nowa tablica", aktywność przestrzeni

### D. Osobiste
- [x] `D1-powiadomienia.dc.html` — skrzynka: wzmianka z cytatem i szybką odpowiedzią, przypisanie, termin minione, zmiana statusu, auto-zamknięcie, grupy Dzisiaj/Wczoraj, nieprzeczytane z kropką
- [x] `D2-zadania-dla-ciebie.dc.html` — grupy Po terminie / Ten tydzień / Później, przełącznik grupowania, kolumna tablicy
- [x] `D3-to-do.dc.html` — prywatna lista: szybkie dodawanie, sekcje Dzisiaj/Ten tydzień, hover-akcje, licznik 3/8, podpinanie pod zadania
- [x] `D4-kalendarz-osobisty.dc.html` — tydzień: siatka godzin, pasek całodniowy (urlop), spotkania/terminy/przypomnienia w kolorach źródeł, linia „teraz", filtry źrodeł w sidebarze

### E. Narzędzia
- [x] `E1-kontakty.dc.html` — CRM: tabela firm/osób, typy, opiekunowie, karta kontaktu (akcje, NIP, powiązane tablice, osoby, historia)
- [x] `E2-czas-pracy.dc.html` — tydzień zespołu: liczniki, aktywny timer, siatka osób × dni (wpisy/plan/urlop), lista wpisów z flagą fakturowania
- [x] `E3-notatnik.dc.html` — trzy panele: foldery, lista notatek, edytor (retro z akcjami i podpiętym zadaniem)
- [x] `E4-urlopy.dc.html` — limity, wnioski do akceptacji (w tym konflikt), grafik zespołu na wrzesień, historia
- [x] `E5-subskrypcje.dc.html` — koszty mies./rocz., najbliższe odnowienie, nieużywane, tabela usług z płatnikiem i kartą
- [x] `E6-hasla.dc.html` — sejf E2E: wiersz z odsłoniętym hasłem i licznikiem, kopiowanie, dostępy, ostrzeżenie 2FA, dziennik audytu
- [x] `E7-plan-sprzedazy.dc.html` — pipeline dealów: cel Q3, wygrane, wartości ważone, kolumny Lead→Wygrane z % szansy
- [x] `E8-creative-board.dc.html` — karty pomysłów z głosowaniem kropkami (3/os), zrealizowane → zadanie, „Zrób zadanie"
- [x] `E9-support.dc.html` — kolejki SLA, wątek klienta + notatka wewnętrzna, kontekst (klient/zamówienie/#251), kompozytor z szablonem
- [x] `E10-wiki.dc.html` — drzewo stron, spis treści, checklista, callout, powiązane strony, wersjonowanie

### F — dark mode odpuszczony decyzją użytkownika (26 sie).

## tokens.css
`v5/tokens.css` = załączony plik bez zmian + sekcja EXTENSIONS (statusy, priorytety, awatary, gantt, kontrolki, scrim, tabela, z-index). Ekrany mają wartości zapisane wprost (literalnie) — tokens.css jest źródłem prawdy przy wdrożeniu.

## Decyzje odbiegające od briefu (z uzasadnieniem)
1. **Pliki `.dc.html` zamiast `.html`** — format środowiska projektowego; to nadal pojedyncze, statyczne pliki HTML otwierane w przeglądarce, numeracja zachowana.
2. **Style inline w ekranach zamiast klas z tokens.css** — makiety malują się natychmiast podczas streamingu; tokens.css pozostaje kanonem wartości dla wdrożenia.
3. **Układy odtwarzają anatomię opisaną w briefie, ale nie są pikselową kopią Jiry/Airtable** — ich chrome i ikony to cudza własność wizualna; screeny potraktowane jako referencja struktury i gęstości.
4. **Brak plików jira-01/02-timeline.png w załącznikach** — oś czasu (B5) budowana według szczegółowego opisu z briefu.
5. **Checkbox/radio/switch „włączone" w atramencie #1C1A17, nie w pomarańczu** — brief ogranicza pomarańcz do CTA/nawigacji/focus/zaznaczenia wiersza/linków/logo; kontrolki formularzy do tej listy nie należą.
6. **Paski Gantta: pastelowe tło chipowe + ciemny tekst + 1px krawędź w kolorze statusu** — tytuł w pasku pozostaje czytelny bez białego tekstu na kolorze (zakaz z briefu dot. kontrastu).
7. **Emoji z briefu (📎, 💬, ☑…) renderowane jako ikony liniowe 16 px** — spójnie z zasadą „ikony 16 px", bez emoji w UI.
8. **Obramowania pól formularza #D2CEC7 (n-300), struktura #E6E3DE (n-200)** — pola muszą się odróżniać od krawędzi kart przy 1px.
9. **Mobile: wysokość wierszy/celów dotyku 44 px (gęstość „spacious"), przyciski główne pełnej szerokości** — minimalny cel dotykowy.
10. **Ikony własne, geometryczne 16 px (stroke 1.4–1.5)** — zamiast zestawu Atlassian; jeden styl w całym systemie.
11. **A3 na jednym ekranie** — menu Utwórz, menu awatara, skróty i dialog „Dostosuj pasek" pokazane równocześnie nad jednym shellem; w realnej apce otwiera się jedno naraz.
12. **B3 jako jeden plik** — oba dialogi (Nowe zadanie, Import) obok siebie na scrimie, zamiast dwóch plików.
13. **Ekrany-warianty mają skrócony sidebar** (te same wzorce, mniej pozycji) — pełna anatomia sidebara jest w A2 i B1; skraca to pliki bez utraty spójności.
14. **B2: date-picker otwarty w panelu, picker osób w wariancie modal** — obie nakładki naraz zasłaniałyby prawą kolumnę Szczegółów.
15. **Daty przykładowe osadzone wokół „dziś" = wt 26 sie 2026** — spójne między Listą, Kanbanem, Osią czasu i Kalendarzem.
