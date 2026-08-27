Jesteś senior product designerem. Projektujesz JEDEN ekran aplikacji FLOVLY — polskojęzycznego narzędzia do zarządzania projektami klasy Jira/ClickUp/Airtable. Reszta aplikacji jest już zaprojektowana i wdrożona; ten ekran ma do niej pasować co do piksela, a nie wprowadzać własnego języka wizualnego.

Ekran: **E5 — Subskrypcje** (`/w/<przestrzeń>/subscriptions`).
Wersja poprzednia istnieje i została odrzucona jako zbyt uboga: dwa kafle, pięć kolumn, brak stanów i brak sensownej pracy z wieloma pozycjami. Projektujesz ją od nowa.

Załączniki (przeczytaj/obejrzyj wszystkie zanim zaczniesz):
- `tokens.css` — dokładne wartości kolorów, typografii, promieni, cieni. Używaj wyłącznie ich.
- `A1-design-system.dc.html` — gotowe komponenty: przyciski, chipy, inputy, selecty, tabela, dialog, popover, pusty stan.
- `A2-app-shell.dc.html` — pasek górny 48px i pasek boczny 240px, w których ten ekran siedzi. NIE projektuj ich od nowa, tylko wstaw ekran w środek.
- `B1-lista.dc.html` — wzorzec gęstej tabeli: nagłówek 32px sticky, wiersze 44px, edycja w komórce, pasek filtrów, stopka z podsumowaniem. Subskrypcje mają wyglądać jak jego krewny, nie jak osobny produkt.
- `E2-czas-pracy.dc.html` — wzorzec kafli KPI nad tabelą.
- `airtable-grid.png` — gęstość i ikony typów pól w nagłówkach.

════════════════════════════════════════
1. CO TEN EKRAN MA ROBIĆ
════════════════════════════════════════
Zespół trzyma tu wykaz firmowych subskrypcji (Figma, Slack, Vercel, hosting, domeny) i chce w trzy sekundy odpowiedzieć na pytania: ile nas to kosztuje miesięcznie, ile rocznie, co należy do którego projektu i kto ma do czego dostęp.

Praca odbywa się bezpośrednio w tabeli — bez dialogu „dodaj". Nowy wiersz pojawia się pusty, z kursorem w nazwie, i zapisuje się sam.

════════════════════════════════════════
2. DANE, KTÓRE ISTNIEJĄ (i tylko te)
════════════════════════════════════════
To jest twarde ograniczenie: baza ma dokładnie te pola i nie wolno projektować niczego, co wymagałoby nowych. Element bez danych to element, który po wdrożeniu byłby pusty.

Subskrypcja:
- `name` — nazwa usługi (tekst)
- `url` — adres strony (opcjonalny)
- `amountCents` — kwota w groszach, waluta zawsze PLN
- `cycle` — `MONTHLY` albo `YEARLY`, nic pomiędzy
- `notes` — jedna linia notatki (opcjonalna)
- `projectId` — opcjonalne przypisanie do projektu
- `deletedAt` — miękkie usunięcie

Projekt (`SubscriptionProject`):
- `name`
- `members` — lista osób z przestrzeni mających do niego dostęp

Widoczność: administrator przestrzeni widzi wszystko. Zwykły członek widzi subskrypcje nieprzypisane do żadnego projektu oraz te z projektów, do których należy. Zaprojektuj to tak, żeby było zrozumiałe, a nie zaskakujące („czemu kolega widzi 12 pozycji, a ja 5?").

**Nie projektuj** (brak danych w bazie, po wdrożeniu byłyby atrapami): daty odnowienia, przypomnień przed odnowieniem, płatnika, karty/metody płatności, statusu „nieużywana", historii płatności, faktur, walut innych niż PLN, właściciela subskrypcji, licencji per osoba.

════════════════════════════════════════
3. CO MUSI BYĆ NA EKRANIE
════════════════════════════════════════
Nagłówek: tytuł „Subskrypcje" + licznik aktywnych, filtr projektu, przycisk „Projekty i dostępy" (tylko administrator), przycisk „Dodaj subskrypcję".

Podsumowanie: koszt miesięczny i roczny (prognoza). Roczne pozycje przelicz na miesiąc i odwrotnie — użytkownik ma widzieć jedną wspólną skalę, a nie dwie osobne kwoty do dodania w głowie. Kwoty w foncie mono. Sumy reagują na filtr projektu.

Tabela: usługa (kafel z inicjałem + nazwa + notatka pod spodem), projekt, cykl, kwota (wyrównana do prawej, mono), status. Nagłówek 32px sticky, wiersze 44px. Edycja w komórce: nazwa, kwota, cykl i projekt zmieniane bez wychodzenia z tabeli. Kwota pokazuje „129,99 zł" w spoczynku, a „129,99" w trakcie edycji.

Dialog „Projekty i dostępy": tworzenie projektu, chipy członków do zaznaczania, usuwanie projektu z informacją, że jego subskrypcje wrócą do puli wspólnej.

Stopka: liczba subskrypcji i koszt miesięczny.

Stany, których poprzednia wersja nie miała i które chcę zobaczyć narysowane:
- **pusty** — przestrzeń bez żadnej subskrypcji
- **pusty po filtrze** — projekt bez subskrypcji, z wyjściem z filtra
- **wiersz świeżo dodany** — pusty, w edycji, z kursorem w nazwie
- **wiersz w trakcie zapisu** i **wiersz, którego zapis się nie powiódł**
- **członek bez dostępu do części projektów** — jak komunikujemy, że lista jest przycięta
- **dużo pozycji** (30+) — jak zachowuje się sticky nagłówek i sumy

════════════════════════════════════════
4. CZEGO NIE ROBIĆ
════════════════════════════════════════
Zero glassmorphismu, rozmyć tła, gradientów, cieni w kolorze marki, animowanych liczników, dużych ilustracji w pustych stanach. Pomarańcz `#FF5C00` wyłącznie na: przycisk główny, aktywny element nawigacji, focus ring, pasek zaznaczonego wiersza, linki. Nigdy jako tło karty, nagłówka ani kafla. Biały tekst na pomarańczowym jest zakazany — tekst na pomarańczu to `#14110D`.

Nie projektuj dashboardu. To jest arkusz z sumami, nie panel zarządczy. Jeśli ekran wygląda jak szablon „SaaS analytics", zacznij od nowa.

════════════════════════════════════════
5. CO ODDAJESZ
════════════════════════════════════════
Pliki HTML w tej samej konwencji co pozostałe makiety (`*.dc.html`, style inline, tokeny z `tokens.css`):
1. `E5-subskrypcje.dc.html` — 1440×900, stan podstawowy z ośmioma pozycjami i jednym wierszem zaznaczonym
2. `E5-subskrypcje-stany.dc.html` — cztery stany z punktu 3 na jednej stronie, jeden pod drugim, podpisane
3. `E5-subskrypcje-projekty.dc.html` — dialog „Projekty i dostępy"
4. `E5-subskrypcje-mobile.dc.html` — 390×844, ta sama funkcjonalność jako lista kart

Do każdego pliku dopisz na dole komentarz HTML z listą decyzji, które podjąłeś, i miejsc, w których dane z punktu 2 cię ograniczyły.
