# MAP — FLOVLY redesign v5 (Claude Design → produkcja)

Data: 2026-08-26. Źródło prawdy wyglądu: `docs/redesign/v5/*.dc.html` (47 plików, PNG w `v5/png/`), `docs/redesign/v5/tokens.css`. Źródło prawdy funkcji: `docs/redesign/FUNCTIONAL-SPEC.md`. Reguły wdrożenia: `docs/redesign/PROMPT.md`.

## D1: Zakres = pełne wdrożenie makiet v5 na istniejącym backendzie
- Decision: Przepisujemy CAŁĄ warstwę UI (globals.css, components/ui, layout, wszystkie widoki i moduły) tak, by odpowiadała 1:1 makietom v5. Backend (Prisma, actions, API, lib/**) nietykalny — jak w `PROMPT.md §1`.
- Why: Klient odrzucił obecne UI; makiety są gotowe i kompletne; backend działa.
- Done looks like: Każdy ekran z README v5 ma odpowiednik w aplikacji, który renderuje te same elementy w tej samej kolejności i z tymi samymi wartościami tokenów; `prisma/schema.prisma` i `app/**/actions.ts` bez zmian w `git diff v4-pre-redesign..HEAD`.

## D2: Deploy bezpośrednio na `main`, po każdej fazie
- Decision: Praca na `main`; koniec każdej z 6 faz (D10) = commit + push = auto-deploy Coolify na produkcję. Rollback = `docs/redesign/ROLLBACK.md` (tag `v4-pre-redesign`).
- Why: Decyzja użytkownika (Q1): klient ma widzieć postęp na żywo.
- Done looks like: Po każdej fazie `git log main` ma commit `redesign(F<n>): …`, a produkcja odpowiada 200 na `/secure-access-portal` z nowym shellem.

## D3: Bramka jakości przed każdym pushem
- Decision: Push na `main` dopiero gdy: `npx tsc --noEmit` = 0 błędów, `npm run lint` = 0 błędów, `npm run build` przechodzi, `npx playwright test` (wszystkie specy w `e2e/`) zielone na stagingu, a krytyk potwierdził wszystkie checki fazy w ANSWER-KEY.
- Why: „Każda funkcja ma działać w 100% bez błędów" + deploy prosto na prod.
- Done looks like: Log krytyka fazy w `docs/redesign/gauntlet/F<n>.md` z pass na każdym checku; brak `console.error` w e2e (fixture `e2e/fixtures/console-errors.ts`).

## D4: Staging = lokalna baza z `.env` (Supabase), nie produkcja (Coolify)
- Decision: Lokalny `npm run dev` (:3100) i Playwright pracują na bazie z `.env` (Supabase `emcybjbjzwqjfqscjogz`), która jest starą kopią sprzed migracji K83–K141. Przed startem: `npx prisma migrate deploy` + `npm run db:seed` (admin `admin@danielos.local`). Produkcja Coolify nie jest dotykana do momentu pusha.
- Why: Użytkownik wybrał staging z Playwright (Q4); istniejąca baza już pełni tę rolę — zero pracy w Coolify.
- Done looks like: `npx prisma migrate status` → „Database schema is up to date"; login e2e (`e2e/01-auth.spec.ts`) zielony.

## D5: Ekrany bez makiet = nowy shell + tokeny + komponenty A1, układ środka bez zmian
- Decision: Ekrany niepokryte makietami (login, zaproszenie, share, admin ×7, ⌘K, panel AI, onboarding, członkowie, ustawienia przestrzeni, profil, przypomnienia, lista przestrzeni, lista whiteboardów, kalendarz przestrzeni) dostają nowy top bar/sidebar i są przemalowane prymitywami z `components/ui` (A1), ale ich układ wewnętrzny zostaje. Dopieszczenie po dostarczeniu makiet.
- Why: Decyzja użytkownika (Q2/Q5): „zrób to co mamy, jak czegoś brakuje to dorobimy".
- Done looks like: Na tych ekranach `grep` nie znajduje starych klas (`glass`, `aura`, `lg-vs-`, `lg-seg`), a przyciski/inputy/tabele to komponenty z `components/ui/*`.

## D6: Dark mode usunięty całkowicie
- Decision: Brak trybu ciemnego: usuwamy `ThemeToggle`, boot script, klasę `dark` z `<html>`, pozycję „Motyw" z menu awatara, wszystkie reguły `.dark`/`dark:`. Blok `.dark` z tokens.css NIE jest przenoszony.
- Why: Decyzja użytkownika (Q2): „zrezygnowaliśmy totalnie z dark mode na razie".
- Done looks like: `grep -rn "dark:" app components` → 0; `<html>` bez klasy `dark`; menu awatara bez „Motyw".

## D7: Elementy makiet bez danych w backendzie są pomijane, układ zostaje
- Decision: Bez zmian schematu. Elementy makiet, dla których backend nie ma danych (m.in. budżet w B8/B1, SLA i kolejki w E9, % szansy i cel Q3 w E7, płatnik/karta/odnowienie/„nieużywane" w E5, głosowanie kropkami i limit 3/os w E8, dziennik audytu i 2FA-warning w E6, siatka godzinowa/Google Calendar w D4, wersjonowanie w B11/E10, „cel 40h"/plan w E2, karty zespołu w D1 „szybka odpowiedź", Ostatnie/Oznaczone = localStorage) — nie są renderowane. Kolumna/kafel znika, reszta układu bez zmian. Lista w `docs/redesign/OMITTED.md`.
- Why: Decyzja użytkownika (Q3): zero ryzyka migracji na prod w tej rundzie.
- Done looks like: `OMITTED.md` wymienia każdy pominięty element z ekranem; `git diff v4-pre-redesign -- prisma/` pusty.

## D8: Nazwa i logo
- Decision: Wordmark = `process.env.NEXT_PUBLIC_APP_NAME ?? "FLOVLY"` (Inter 800, 15px, tracking -0.4px w top barze). Znak = kula z makiet: `<svg viewBox="0 0 80 80"><clipPath><circle r=40/></clipPath><circle fill=#FF5C00/><rect 48×48 rotate(45 50 50) fill=#14110D/></svg>` jako `components/brand/mark.tsx`; `app/icon.svg` i `app/opengraph-image.tsx` z tego samego znaku.
- Why: Decyzja użytkownika (Q6); nazwa docelowa nieznana.
- Done looks like: `grep -rn "flovly-logo\|FlovlyLogo" app components` → 0; favicon = pomarańczowa kula.

## D9: Tokeny i typografia dokładnie z v5
- Decision: `app/globals.css` = import Inter (400–800) + JetBrains Mono (400–600) + `:root` z `v5/tokens.css` (bez bloku `.dark`) + Tailwind v4 `@theme` mapujący te zmienne. Body 13px/20px, tabela 13px, eyebrow 11px/600/uppercase/.06em; radius 4/6/8/12; top bar 48, sidebar 240/56, tabsy 40, panel 600, wiersz 36 (28/44 w gęstościach). Pomarańcz tylko: CTA, aktywna nawigacja/tab, focus, zaznaczony wiersz, linki, logo. Kontrolki formularzy „on" = `#1C1A17`. Brak cieni na kartach; `--shadow-e1` popovery, `--shadow-e2` dialogi/panel. Zero: gradientów jako tła, `backdrop-blur`, `transition-all`, spring easing.
- Why: README v5 pkt „tokens.css jest źródłem prawdy"; guardrails z PROMPT §1–2.
- Done looks like: Checki AK grep + pomiary Playwright (wysokości/kolory) przechodzą.

## D10: Sześć faz, każda deployowana
- Decision:
  1. **F1 Fundament** — tokens/globals, `components/ui/*` (A1), `components/brand/mark`, top bar + menu Utwórz + menu awatara + arkusz skrótów + dialog „Dostosuj pasek" (A3), sidebar 240/rail 56/drawer mobile (A2), board header + tabsy + toolbar (A2), usunięcie dark mode i legacy, `app/layout.tsx`/icon/OG, `loading.tsx` skeletony shell.
  2. **F2 Lista + zadanie** — B1 (+grupowana, mobile), B2 (panel/modal/pełna strona/mobile), B3 (Nowe zadanie + Import), B12 (Nowy widok).
  3. **F3 Widoki tablicy** — B4 (+swimlane, mobile), B5 (+rozwinięta, mobile), B6 (+markery), B7 (+mobile), B8, B9 chrome, B10, B11.
  4. **F4 Przestrzeń + osobiste** — C1, D1, D2, D3, D4, plus ekrany bez makiet z tej grupy (Przypomnienia, Profil, lista przestrzeni, kalendarz przestrzeni) wg D5.
  5. **F5 Narzędzia** — E1–E10 + Whiteboardy lista wg D5.
  6. **F6 Reszta + hardening** — auth, zaproszenie, share, admin ×7, ⌘K, panel AI, onboarding, członkowie, ustawienia (wg D5); aktualizacja selektorów e2e; mobile pass 390/768; a11y pass; screeny wszystkich tras do `docs/redesign/screens/`.
- Why: Decyzja użytkownika (Q7); F1 przemalowuje całą aplikację globalnie, więc od pierwszego deployu nie ma fioletu.
- Done looks like: 6 commitów `redesign(F1..F6)` na `main`, każdy po zielonej bramce D3.

## D11: Widok zadania w 3 trybach
- Decision: Panel boczny 600px (domyślny z każdej listy; lista pod spodem widoczna i interaktywna, bez przyciemnienia; B2), modal 960px (z ⌘K/powiadomień; B2-modal), pełna strona `/w/[id]/t/[taskId]` (B2-pełna-strona; przycisk ⤢ w nagłówku). Mechanizm intercepting route `@modal/(.)t/[taskId]` + `route-tracker` zostają (return-to + scroll).
- Why: Makiety B2 ×4; K135/K138 już rozwiązały powroty.
- Done looks like: Klik w wiersz Listy otwiera panel bez nawigacji pełnej strony; `Esc` wraca do tej samej pozycji scrolla (±5px); pełna strona ma prawą kolumnę 280px „Szczegóły".

## D12: Ikony = inline SVG z makiet
- Decision: Ikony 16px, stroke 1.4–1.5, geometryczne — wyciągnięte z makiet do `components/ui/icons.tsx` (nazwy wg funkcji: `IconBell`, `IconList`, `IconBoard`, `IconTimeline`, `IconRoadmap`, `IconCalendar`, `IconWhiteboard`, `IconTaskline`, `IconDoc`, …). Lucide (`strokeWidth 1.5`, 16px) dozwolone tylko dla ikon, których makiety nie zawierają.
- Why: README v5 pkt 10 („ikony własne, jeden styl"); „trzymaj się idealnie makiet".
- Done looks like: Zakładki tablicy i sidebar używają ikon z `icons.tsx`; brak emoji w UI (`grep -P "[\x{1F300}-\x{1FAFF}]" components app` → 0 poza danymi).

## D13: Sidebar dokładnie jak A2/A3
- Decision: Sekcje i kolejność: **Dla Ciebie** (Powiadomienia+badge, Zadania dla Ciebie+licznik, TO DO, Kalendarz, Notatnik, Przypomnienia, Urlopy) · **Ostatnie ›** / **Oznaczone gwiazdką ›** (localStorage `ui:recent`, `ui:starred`) · **Przestrzenie** [+] (workspace → tablice, drag-reorder zachowany, aktywna = `#FFF4EE` + rail 2px `#FF5C00`) · **Narzędzia** (Kontakty, Plan sprzedaży, Czas pracy, Hasła, Subskrypcje, Creative Board, Support, Wiki, Whiteboardy — dla aktywnej przestrzeni, inaczej pierwszej) · **Więcej** (Wszystkie przestrzenie, Panel admina [super-admin], Dostosuj pasek) · stopka: karta użytkownika (avatar, imię, rola, ⋯). Zwinięty rail 56px z tooltipami; stan w `ui:sidebar`. „Dostosuj pasek" = dialog 520px z checkboxami sekcji Dla Ciebie + Narzędzia, zapis `ui:sidebar-items`. Mobile: drawer 300px nad scrimem `rgba(15,14,12,.4)`.
- Why: Makiety A2 ×3, A3.
- Done looks like: Kolejność pozycji w DOM identyczna z listą wyżej; szerokość sidebara 240/56; drawer na 390px.

## D14: Top bar dokładnie jak A2/A3
- Decision: 48px, biały, 1px `#E6E3DE`: [≡] [znak+nazwa] … [szukaj 480×32 z kbd ⌘K] [+ Utwórz ▾ pomarańczowy 32px] … [🔔 badge czerwony] [? skróty] [⚙] [avatar ▾]. Menu Utwórz: Zadanie(C), Tablica, Przestrzeń, Kontakt, Deal, Notatka, Przypomnienie, Wpis czasu. Menu awatara: nagłówek (avatar, imię, e-mail) · Ustawienia konta · Powiadomienia · Uwierzytelnianie 2FA · Sesje · — · Gęstość (28/36/44 px) · — · Panel admina · Wyloguj (czerwony). Bez pozycji „Motyw" (D6).
- Why: Makiety A2/A3; D6.
- Done looks like: `data-ui="topbar"` ma wysokość 48; menu Utwórz ma 8 pozycji w tej kolejności.

## D15: Gęstość jako preferencja użytkownika
- Decision: Trzy gęstości wierszy 28/36/44 (domyślnie 36), przełącznik w toolbarze Listy („Gęstość ▾") i w menu awatara; zapis `localStorage ui:density`; dotyczy Listy, Kanbanu (odstępy kart), tabel narzędzi.
- Why: A1 „3 gęstości", A2 toolbar, A3 menu.
- Done looks like: Zmiana na „compact" ustawia wysokość wiersza Listy na 28px i przetrwa reload.

## D16: Toolbar tablicy współdzielony i trwały per widok
- Decision: Wspólny pasek (A2): [Szukaj w tablicy 200px] [stos awatarów-filtr] [Status ▾] [Priorytet ▾] [Tag ▾] [+ Filtr] … [Grupuj ▾] [Sortuj ▾] [Kolumny] [Gęstość ▾] | [⋯] — dla Lista/Tablica/Oś czasu/Kalendarz; filtry jako chipy `#FFE8DB/#8A3000` z ✕ (B1-mobile) i „Wyczyść"; zapis w `BoardView.configJson` przez istniejące akcje.
- Why: A2, B1, B1-pogrupowana, B4.
- Done looks like: Ustawiony filtr Status przetrwa reload strony Listy; ten sam chip widoczny po przejściu na Tablicę.

## D17: Lista = prawdziwa tabela Airtable-style (B1)
- Decision: `<table>` z sticky nagłówkiem 32px (`#FAF9F7`, 11px uppercase, ikona typu pola), zamrożone kolumny ☐(36px)/#ID(56px)/Tytuł(392px), linie siatki `#ECE9E4`, hover `#F3F1EE`, zaznaczony `#FFF4EE`+rail, komórka w edycji z focus ring pomarańczowym, inline edit każdej komórki, menu nagłówka kolumny, builder filtrów, grupowanie z nagłówkami grup (chip statusu + licznik + Σ dla NUMBER), pasek akcji zbiorczych, „+ Dodaj zadanie" na dole, stopka 32px `#FAF9F7` z licznikiem mono. Mobile (B1-mobile): karty w kontenerze `border-radius:8px`, przycisk pełnej szerokości 44px „Dodaj zadanie". Wszystkie funkcje z FUNCTIONAL-SPEC §3.1.
- Why: Makiety B1 ×3 + spec.
- Done looks like: Checki AK dla B1.

## D18: Widoki B4–B12 per makieta
- Decision: Kanban (B4): kolumny 280px, nagłówek `NAZWA · N` 11px uppercase + WIP chip + [+][⋯], karty 8px radius/10×12px padding, slot docelowy `#FFF4EE` przerywany pomarańczowy, kolumna zwinięta 40px pionowa; swimlane wg przypisanego (B4-swimlane); mobile = jedna kolumna + przełącznik statusów (B4-mobile). Oś czasu (B5): lewa tabela 452px (☐, ›, #ID 48px, tytuł z paskiem postępu milestone'u), prawa siatka miesięcy, linia „Dziś" 2px `#FF5C00` z etykietą, paski 20px pastel + 1px krawędź statusu + ciemny tekst, uchwyty dat, strzałki zależności `#B0ABA3`, segmented Dzisiaj/Tygodnie/Miesiące/Kwartały prawy dół, mobile poziomy scroll 560px. Roadmapa (B6): segmented Paski/Markery + przełącznik „Tablica zbiorcza"; paski milestone'ów `#FFE8DB/#E04E00` z rozwiniętymi zadaniami; markery = kropki z liczbą zadań + przerywane łuki; dialog milestone'a 440px. Kalendarz (B7): siatka pon–nd, pigułki 20px z paskiem 3px statusu, „+N więcej" pomarańczowe, popover dnia 280px, mobile mini-siatka z kropkami + lista dnia. Podsumowanie (B8): 4 KPI (Ukończone, W toku, Po terminie, [Budżet — pominięty D7 → 3 KPI + „Utworzone 7d" z AuditLog? NIE — 3 KPI]), pasek statusów, obciążenie zespołu, milestone'y, ostatnia aktywność. Whiteboard (B9): kanwa kropkowana `radial-gradient(#D2CEC7 1px, transparent 1px) 24px`, toolbar dolny centralny 8px radius, zoom prawy dół, silnik bez zmian. Linia zadań (B10): pigułki etapów 36px (aktywna `#1C1A17`), łączniki ze strzałką, kolumny etapów, slot upuszczania. Opis (B11): toolbar formatowania 28px, treść max 760px, stopka „Zapisano · hh:mm". Nowy widok (B12): picker 9 kafli 3×3, aktywny `#FFF4EE` + 2px pomarańcz, nazwa, widoczność, checkbox „Przenieś filtry".
- Why: Makiety; spec §3.2–3.9.
- Done looks like: Checki AK per widok.

## D19: Przestrzeń i moduły osobiste (C1, D1–D4) per makieta
- Decision: C1: nagłówek z kaflem-literą 40px, meta „N tablic · N osób · utworzona…", [Zaproś][Nowa tablica][⋯], tabsy Tablice/Członkowie/Ustawienia, karty tablic 3 kolumny (nazwa, gwiazdka, opis, pasek postępu + licznik, awatary, „N po terminie"), kafel „Nowa tablica" przerywany, „Ostatnia aktywność w przestrzeni". D1: tabsy Nieprzeczytane/Wzmianki/Przypisania/Wszystkie, grupy Dzisiaj/Wczoraj, karta nieprzeczytana `#FFF4EE`+rail+kropka, cytat komentarza, przyciski [Odpowiedz][Otwórz zadanie]/[Przesuń termin]. D2: grupy Po terminie/Ten tydzień/Później w kontenerach 8px, wiersze 44px, segmented Wg terminu/tablicy/priorytetu. D3: input szybkiego dodawania 40px z focus ring, sekcje Dzisiaj/Ten tydzień, hover-akcje (kalendarz, przenieś, usuń), licznik „3/8 dziś". D4: tydzień z kolumną godzin 56px, wiersz „cały dzień", linia „teraz" pomarańczowa, filtry źródeł w sidebarze (Terminy zadań, Przypomnienia, Urlopy zespołu; Google Calendar pominięty D7); zachowany istniejący widok miesiąca jako segmented „Miesiąc".
- Why: Makiety.
- Done looks like: Checki AK.

## D20: Narzędzia E1–E10 per makieta
- Decision: Wszystkie tabele narzędzi na wspólnym prymitywie DataTable (nagłówek 32px sticky, wiersze 44px, siatka `#ECE9E4`, kontener 4px radius). E1 Kontakty: kafel-inicjały, chip typu, karta kontaktu jako panel prawy 380px z akcjami Napisz/Zadzwoń/Zadanie, NIP, powiązane tablice, osoby, historia. E2 Czas pracy: 4 kafle KPI (w tym „Timer aktywny" `#FFF4EE`), segmented Mój czas/Zespół/Raport, siatka osoba×dni z chipami wpisów 16px, lista wpisów dnia z checkboxem „fakt.". E3 Notatnik: 3 panele (sidebar z folderami, lista 320px, edytor 680px), „Zapisano hh:mm". E4 Urlopy: 3 kafle, grafik zespołu (tygodnie), wnioski z [Zatwierdź][Odrzuć], historia. E5 Subskrypcje: 2 kafle KPI (Miesięcznie, Rocznie; „Najbliższe odnowienie"/„Nieużywane" pominięte D7), tabela Usługa/Projekt/Cykl/Kwota/Status, inline edit. E6 Hasła: chip „Szyfrowane E2E", tabela Usługa/Login/Hasło(•••• + 👁 + kopiuj)/Dostęp/Zmienione, wiersz odsłonięty `#FFF4EE`, „sejf odblokowany · auto-blokada 10 min", info-box. E7 Plan sprzedaży: 3 kafle (Wygrane, W pipeline, Najbliższy krok — „Cel Q3" pominięty D7), kolumny etapów 264px, karty z kwotą mono, aktywna `#FFF4EE`. E8 Creative Board: siatka 3 kolumn kart 14px padding, chip kategorii, przycisk „Zrób zadanie" pomarańczowy; głosowanie pominięte D7. E9 Support: sidebar kolejek (Otwarte/W obsłudze/Rozwiązane) z licznikami, lista 400px, wątek z bańkami (klient / notatka wewnętrzna `#FDFAF0`), kompozytor z tabsami Odpowiedź/Notatka; SLA pominięte D7. E10 Wiki: drzewo stron 280px, „Na tej stronie" spis, treść 720px, przycisk Edytuj.
- Why: Makiety; spec §6.
- Done looks like: Checki AK.

## D21: Haki testowe `data-ui`
- Decision: Każdy główny region ma stały atrybut `data-ui`: `topbar`, `sidebar`, `sidebar-rail`, `mobile-drawer`, `board-header`, `board-tabs`, `board-toolbar`, `list-table`, `list-row`, `task-panel`, `task-modal`, `task-page`, `kanban-column`, `kanban-card`, `gantt-left`, `gantt-grid`, `gantt-today`, `roadmap`, `calendar-grid`, `summary-kpi`, `whiteboard-toolbar`, `taskline-stage`, `create-menu`, `avatar-menu`, `shortcuts-sheet`, `customize-sidebar-dialog`, `create-task-dialog`, `import-dialog`, `new-view-dialog`, `density-menu`, `filter-chip`, `bulk-bar`, `group-header`, `datatable`.
- Why: Krytycy mierzą UI deterministycznie (Playwright), bez zgadywania selektorów.
- Done looks like: Każdy check AK odwołujący się do `[data-ui=…]` znajduje dokładnie 1 element (lub N wierszy).

## D22: Testy e2e zaktualizowane, nie usunięte
- Decision: Istniejące `e2e/01–12` dostosowane do nowych selektorów (preferencja `data-ui`/role), nadal wszystkie przechodzą; nowe specy `e2e/2x-redesign-*.spec.ts` per faza pokrywają checki AK, które da się zautomatyzować. Fixture `console-errors` w każdym specu.
- Why: D3; „100% bez błędów" musi być dowodem.
- Done looks like: `npx playwright test` → 0 failed, 0 skipped z powodu „selector needs updating".

## D23: Legacy do wycięcia
- Decision: Usunąć: `components/brand/flovly-logo.tsx`, klasy `.lg-vs-*`, `.lg-seg*`, `.sidebar-glass`, `.dialog-glass`, `.popover-glass`, `.bg-aura`, `.shadow-aura`, font Onest, tokeny fioletowe (`#7A33EC`, `#7C5CFF`, `#E1318F`, `--paper`, `--card` violet), `ThemeToggle`, gradient tła w `app/(app)/layout.tsx`, stare `icon.svg`/OG.
- Why: PROMPT §7; jedno źródło tokenów.
- Done looks like: grep AK1–AK3 = 0.

## D24: Zoom lock i istniejące mechanizmy zostają
- Decision: Viewport `maximumScale 1, userScalable false` zostaje (życzenie klienta). Route tracker, intercepting modal, realtime, toaster, popupy przypomnień, onboarding tour, ⌘K, rate-limit messages — działają bez zmian funkcji, tylko przemalowane.
- Why: Spec §0; K135/K138.
- Done looks like: `app/layout.tsx` ma `userScalable: false`; e2e 05/10/11 zielone.

## D25: Weryfikacja wizualna = porównanie PNG
- Decision: Każdy ekran z makietą ma screenshot 1440×900 (i 390×844 dla ★) w `docs/redesign/screens/<ID>.png`, zrobiony Playwright na stagingu z danymi seed. Krytyk porównuje z `docs/redesign/v5/png/<ID>.png` i ocenia binarnie per lista elementów w checku (obecność, kolejność, kolory tokenów), nie „na oko".
- Why: Binarne checki zamiast oceny 1–10.
- Done looks like: Para PNG istnieje dla każdego ID; checki AK per ekran pass.

## Out of bounds
- Dark mode w jakiejkolwiek formie (D6).
- Zmiany w `prisma/`, `lib/**`, `app/**/actions.ts`, `app/api/**`, `middleware.ts` (D1, D7).
- Nowe funkcje backendowe z makiet: SLA/kolejki supportu, budżety, wersjonowanie dokumentów, głosowanie kropkami, kalendarz godzinowy z Google, płatnik/karta/odnowienia subskrypcji, % szansy dealu, cel kwartalny, dziennik audytu sejfu, ostrzeżenia 2FA, plan godzin/„cel 40h", szybka odpowiedź z powiadomienia (D7).
- Zmiana nazwy produktu, nowe logo poza kulą (D8).
- Makiety/nowe układy dla ekranów spoza listy README v5 (D5).
- i18n, dodatkowe języki.
- Branch inny niż `main`, PR-y (D2).
- Jakiekolwiek animacje poza opacity/transform 100–220ms; `transition-all`; spring (D9).
