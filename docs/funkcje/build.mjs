// Buduje dokumentację funkcji FLOVLY: HTML + PDF (A4 poziomo) ze zrzutami z img/.
// Uruchomienie: node docs/funkcje/build.mjs  (wymaga puppeteer z katalogu głównego JARVIS-WEB)
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(resolve(here, "../../../../package.json"));
const puppeteer = require("puppeteer");
const sharp = createRequire(resolve(here, "../../package.json"))("sharp"); // sharp z sites/danielos

const img = (name, caption) => ({ name, caption });
// Zrzuty sa @2x (2880 px); do PDF wystarczy 1600 px w JPEG - plik ~15x mniejszy.
const cache = new Map();
async function figSrc(name) {
  if (cache.has(name)) return cache.get(name);
  const p = resolve(here, "img", `${name}.png`);
  if (!existsSync(p)) { console.warn("brak zrzutu:", name); cache.set(name, null); return null; }
  const buf = await sharp(p).resize({ width: 1440, withoutEnlargement: true }).jpeg({ quality: 74, mozjpeg: true }).toBuffer();
  const src = `data:image/jpeg;base64,${buf.toString("base64")}`;
  cache.set(name, src); return src;
}
const fig = ({ name, caption }, cls = "") => { const src = cache.get(name); return src ? `<figure class="${cls}"><img src="${src}" alt="${caption}"><figcaption>${caption}</figcaption></figure>` : ""; };


// Każdy moduł: tytuł, opis, lista możliwości, workflow'y (kroki), zrzuty.
const sections = [
  { id: "start", title: "1. Pierwsze kroki i nawigacja", items: [
    { title: "Logowanie i konto", desc: "FLOVLY działa w przeglądarce na komputerze i telefonie. Logowanie odbywa się pod dedykowanym adresem, konto może być dodatkowo zabezpieczone weryfikacją dwuetapową (kod z aplikacji na telefonie).",
      can: ["Logowanie e-mailem i hasłem, z limitem nieudanych prób", "Weryfikacja dwuetapowa (TOTP) z kodami zapasowymi", "Zmiana hasła, zdjęcia profilowego, imienia i strefy czasowej", "Przewodnik po aplikacji przy pierwszym logowaniu"],
      how: [["Włączenie weryfikacji dwuetapowej", ["Kliknij swój awatar w prawym górnym rogu i wybierz Profil", "W sekcji „2FA” zeskanuj kod QR aplikacją uwierzytelniającą (Google Authenticator, 1Password itp.)", "Wpisz 6-cyfrowy kod i kliknij Potwierdź", "Zapisz kody zapasowe w bezpiecznym miejscu"]]],
      imgs: [img("57-profil", "Profil: statystyki zespołu, ustawienia konta"), img("57a-profil-2fa", "Włączanie weryfikacji dwuetapowej i zmiana hasła")] },
    { title: "Układ aplikacji", desc: "Pasek górny zawiera wyszukiwarkę, przycisk Utwórz, asystenta AI, powiadomienia, skróty klawiszowe i menu użytkownika. Pasek boczny jest podzielony na sekcje: Dla Ciebie, Ostatnie, Oznaczone gwiazdką, Przestrzenie i Narzędzia.",
      can: ["Zwijanie paska bocznego do wąskiego paska ikon", "Ostatnio otwierane tablice pod ręką", "Oznaczanie tablic gwiazdką", "Dostosowanie, które pozycje paska bocznego są widoczne", "Przeciąganie przestrzeni i tablic, aby zmienić ich kolejność"],
      how: [["Dostosowanie paska bocznego", ["Na dole sekcji Narzędzia kliknij Więcej", "Zaznacz pozycje, które mają być widoczne", "Zmiany zapisują się od razu i dotyczą tylko Twojego konta"]]],
      imgs: [img("01-workspaces", "Wszystkie przestrzenie: lista przestrzeni, do których należysz"), img("76-dostosuj-pasek", "Dostosowanie widocznych pozycji paska bocznego"), img("73-menu-uzytkownika", "Menu użytkownika: profil, panel administratora, wylogowanie")] },
    { title: "Wyszukiwarka i paleta poleceń (⌘K / Ctrl+K)", desc: "Jedno okno do wszystkiego: znajduje zadania po tytule lub numerze, tablice, osoby oraz uruchamia akcje (nowa tablica, zaproszenie, ustawienia).",
      can: ["Szukanie zadań, tablic, przestrzeni i osób", "Szybkie akcje: Nowa tablica, Zapraszaj członków, Powiadomienia, Ustawienia konta, Zapytaj AI", "Nawigacja strzałkami, Enter otwiera wynik"],
      how: [["Szybkie otwarcie zadania", ["Naciśnij ⌘K (Mac) lub Ctrl+K (Windows)", "Wpisz fragment tytułu albo numer zadania", "Strzałkami wybierz wynik i naciśnij Enter - zadanie otworzy się w oknie nad bieżącą stroną"]]],
      imgs: [img("70-paleta-polecen", "Paleta poleceń z wynikami wyszukiwania"), img("74-skroty", "Lista skrótów klawiszowych (ikona ? w pasku górnym)")] },
    { title: "Przycisk Utwórz", desc: "Z każdego miejsca w aplikacji tworzysz nowe obiekty: zadanie, tablicę, przestrzeń, kontakt, deal, notatkę, przypomnienie lub wpis czasu.",
      can: ["Skrót C tworzy nowe zadanie"], how: [], imgs: [img("71-utworz-menu", "Menu Utwórz w pasku górnym")] },
  ] },
  { id: "przestrzenie", title: "2. Przestrzenie, tablice i dostęp", items: [
    { title: "Przestrzenie robocze", desc: "Przestrzeń to odrębne środowisko dla firmy, działu lub klienta - z własnymi tablicami, członkami, narzędziami i ustawieniami. Możesz należeć do wielu przestrzeni.",
      can: ["Tworzenie przestrzeni z nazwą, opisem i awatarem", "Strona przeglądu przestrzeni: tablice, członkowie, wydarzenia", "Wybór, które widoki tablic są dostępne w przestrzeni", "Sekcje przestrzeni porządkujące tablice"],
      how: [["Nowa przestrzeń", ["Kliknij + obok nagłówka Przestrzenie w pasku bocznym albo Utwórz → Przestrzeń", "Podaj nazwę - adres (slug) utworzy się automatycznie", "Zaproś członków z zakładki Członkowie"]]],
      imgs: [img("02-workspace-overview", "Przegląd przestrzeni Agencja Nova"), img("49-ustawienia", "Ustawienia przestrzeni: nazwa, włączone widoki")] },
    { title: "Członkowie, role i zaproszenia", desc: "Trzy role: Administrator (pełne prawa, w tym ustawienia i usuwanie), Członek (praca z zadaniami i narzędziami), Obserwator (tylko podgląd). Każda akcja w aplikacji jest sprawdzana pod kątem roli po stronie serwera.",
      can: ["Zaproszenie e-mailem z wybraną rolą", "Zaproszenie ograniczone do jednej tablicy", "Zmiana roli i usuwanie członków", "Zbiorczy podgląd, kto ma dostęp do których tablic"],
      how: [["Zaproszenie nowej osoby", ["Otwórz Członkowie (menu przestrzeni w pasku bocznym)", "Wpisz adres e-mail, wybierz rolę i zakres: cała przestrzeń lub konkretna tablica", "Kliknij Wyślij zaproszenie - osoba otrzyma link ważny przez ograniczony czas", "Zaproszenia oczekujące możesz anulować w tym samym miejscu"]]],
      imgs: [img("47-czlonkowie", "Członkowie przestrzeni z rolami i formularz zaproszenia"), img("47a-zapros", "Zakres zaproszenia: cała przestrzeń lub konkretna tablica"), img("48-czlonkowie-tablice", "Zakładka Tablice: dostęp per tablica")] },
    { title: "Tablice i widoczność", desc: "Tablica to projekt lub obszar pracy z własnymi statusami, polami i widokami. Tablica może być publiczna (widzą ją wszyscy członkowie przestrzeni) lub prywatna (tylko zaproszone osoby i administratorzy).",
      can: ["Nazwa, opis i tło tablicy (kolor, gradient, obraz)", "Widoczność publiczna / prywatna z listą osób i rolą per tablica", "Linki tablicy: szybkie odnośniki do Drive, Sheets, Docs, Slides i innych, z folderami", "Publiczny link do podglądu tablicy dla osób spoza aplikacji (z możliwością odwołania)", "Kolejność tablic w pasku bocznym przeciąganiem", "Tablica zbiorcza agregująca zadania z innych tablic"],
      how: [["Ograniczenie dostępu do tablicy", ["Wejdź w Członkowie → zakładka Tablice", "Wybierz tablicę i ustaw widoczność na Prywatna", "Dodaj osoby przyciskiem „Dodaj istniejącego członka przestrzeni” i nadaj im rolę w tej tablicy"]],
            ["Udostępnienie podglądu klientowi", ["Na tablicy kliknij Udostępnij", "Kliknij + Nowy link - link kopiuje się do schowka", "Gdy współpraca się kończy, kliknij Cofnij dostęp przy linku"]]],
      imgs: [img("65-tablica-prywatna", "Tablica prywatna „Strona www - redesign”"), img("10p-lista-udostepnij", "Publiczne linki do podglądu tablicy"), img("10n-lista-linki-tablicy", "Linki tablicy: odnośniki do materiałów zewnętrznych"), img("10q-lista-menu-tablicy", "Menu tablicy: opis, tło, usuwanie")] },
  ] },
  { id: "lista", title: "3. Widok Lista (tabela)", items: [
    { title: "Lista zadań", desc: "Arkuszowy widok wszystkich zadań tablicy. Każda komórka jest edytowalna bezpośrednio w tabeli, a kolumny to zarówno pola wbudowane (status, priorytet, osoby, tagi, daty, załączniki, milestone), jak i pola własne.",
      can: ["Edycja w komórce: podwójne kliknięcie lub Enter", "Zmiana szerokości kolumn (dwuklik = reset), ukrywanie i przypinanie", "Zmiana kolejności kolumn przeciąganiem", "Gęstość wierszy: kompaktowa / komfortowa / przestronna", "Wyszukiwanie w obrębie tablicy", "Dodawanie wiersza na dole listy", "Eksport CSV i import z CSV/XLSX", "Sumy w grupach dla pól liczbowych"],
      how: [["Szybka zmiana statusu", ["Kliknij w komórkę Status w wierszu zadania", "Wybierz nowy status z listy - zmiana zapisuje się od razu i widzą ją inni w czasie rzeczywistym"]]],
      imgs: [img("10-lista", "Widok Lista tablicy Kampania Q4"), img("10m-lista-edycja-komorki", "Edycja bezpośrednio w komórce"), img("10e-lista-gestosc", "Wybór gęstości wierszy"), img("10t-szukaj-w-tablicy", "Wyszukiwanie w tablicy")] },
    { title: "Pola własne (16 typów)", desc: "Do tablicy dodajesz dowolne kolumny: tekst, długi tekst, liczba (w tym waluta i procent), data, checkbox, wybór, wielokrotny wybór, URL, e-mail, telefon, ocena (gwiazdki), osoba, załącznik oraz pola automatyczne: data utworzenia, data modyfikacji, autonumer.",
      can: ["Konfiguracja opcji wyboru z kolorami", "Format liczby: całkowita, dziesiętna, waluta, procent", "Ocena w skali 1-5 (gwiazdki, serca, kciuki)", "Zmiana typu i nazwy kolumny w dowolnym momencie"],
      how: [["Dodanie pola „Budżet” w złotówkach", ["Kliknij + Dodaj kolumnę na końcu nagłówka tabeli", "Wpisz nazwę, wybierz typ Liczba i format Waluta (PLN)", "Kliknij Utwórz - kolumna pojawi się w Liście i w panelu zadania w sekcji Pola dodatkowe"]]],
      imgs: [img("10i-lista-dodaj-kolumne", "Dodawanie kolumny: typy pól"), img("10h-lista-menu-kolumny", "Menu kolumny: sortuj, filtruj, grupuj, ukryj, konfiguruj"), img("10d-lista-kolumny", "Widoczność kolumn")] },
    { title: "Filtry, sortowanie, grupowanie", desc: "Filtry łączą wiele warunków z 19 operatorami (zawiera, równa się, jest puste, przed/po dacie, większe/mniejsze i inne). Grupowanie tworzy zwijane sekcje z licznikami i sumami. Konfiguracja zapisuje się per widok.",
      can: ["Szybkie filtry: osoby, Status, Priorytet, Tag", "Filtry zaawansowane z wieloma warunkami", "Sortowanie po dowolnej kolumnie", "Grupowanie po statusie, osobie, priorytecie, milestone'ie, tagu lub polu własnym", "Sekcje: grupowanie po specjalnym polu Sekcje z własnymi nazwami"],
      how: [["Grupowanie zadań w sekcje", ["Kliknij Sekcje w pasku narzędzi i dodaj nazwy sekcji (np. Kreacja, Media, Technologia)", "Lista przełączy się na grupowanie po Sekcjach", "Zadanie przenosisz do sekcji zmieniając wartość w kolumnie Sekcje lub przeciągając wiersz"]],
            ["Filtr „moje zadania do zrobienia”", ["Kliknij Filtr → Dodaj warunek", "Wybierz pole Przypisani, operator „zawiera” i siebie", "Dodaj drugi warunek: Status „nie jest” Done"]]],
      imgs: [img("10a-lista-filtr", "Filtry widoku z wieloma warunkami"), img("10g-lista-status-filtr", "Szybki filtr po statusie"), img("10b-lista-grupuj", "Wybór pola do grupowania"), img("10l-lista-zgrupowana-sekcje", "Lista zgrupowana w sekcje z sumami budżetu"), img("10c-lista-sortuj", "Sortowanie")] },
    { title: "Zaznaczanie i akcje masowe", desc: "Zaznaczasz wiele zadań (klik = pojedyncze, Shift+klik = zakres, nagłówek = wszystkie) i zmieniasz je jednym ruchem.",
      can: ["Zmiana statusu, priorytetu, przypisanych i tagów dla wielu zadań", "Przenoszenie zadań na inną tablicę", "Usuwanie wielu zadań"],
      how: [["Przeniesienie kilku zadań na inną tablicę", ["Zaznacz zadania checkboxami", "W dolnym pasku kliknij Przenieś", "Wybierz tablicę docelową - zadania dostaną nowe numery i status domyślny tej tablicy"]]],
      imgs: [img("10j-lista-zaznaczenie", "Zaznaczone zadania i pasek akcji masowych"), img("10k-lista-akcje-masowe", "Zmiana statusu dla zaznaczonych")] },
    { title: "Import zadań z pliku", desc: "Zadania importujesz z CSV lub XLSX - kolumny pliku mapujesz na pola tablicy, a podgląd pokazuje, co zostanie utworzone.",
      can: ["Mapowanie kolumn pliku na tytuł, status, priorytet, osoby, daty, pola własne", "Podgląd przed importem"],
      how: [["Import", ["Kliknij Import CSV/XLS w nagłówku tablicy", "Wybierz plik i dopasuj kolumny", "Sprawdź podgląd i kliknij Importuj"]]],
      imgs: [img("10o-lista-import", "Import zadań z pliku")] },
  ] },
  { id: "kanban", title: "4. Widok Tablica (Kanban)", items: [
    { title: "Kanban", desc: "Kolumny odpowiadają statusom. Karty przeciągasz między kolumnami i w obrębie kolumny; kolejność kolumn zmieniasz przeciągając nagłówek.",
      can: ["Przeciąganie kart (zmiana statusu) i kolumn (kolejność)", "Limit WIP na kolumnę i zwijanie kolumn", "Swimlane'y: podział na tory według osoby lub priorytetu", "Szybkie dodanie zadania na dole kolumny", "Karty pokazują numer, priorytet, tagi, postęp podzadań, komentarze, powiązania, termin i osoby", "Filtry i wyszukiwanie jak w Liście"],
      how: [["Włączenie swimlane'ów według osoby", ["Kliknij Grupuj w pasku narzędzi", "Wybierz Przypisany - tablica podzieli się na tory per osoba, kolumny statusów zostają"]],
            ["Nowa kolumna statusu", ["Kliknij + na końcu kolumn", "Wpisz nazwę i wybierz kolor", "Kolumna pojawia się we wszystkich widokach tablicy"]]],
      imgs: [img("11-kanban", "Tablica Kanban"), img("11c-kanban-swimlane", "Swimlane'y według osoby"), img("11a-kanban-menu-kolumny", "Opcje kolumny: limit WIP, kolor, zwijanie, usuwanie"), img("11b-kanban-grupuj", "Wybór grupowania"), img("11d-kanban-szybkie-dodanie", "Szybkie dodawanie zadania w kolumnie")] },
  ] },
  { id: "gantt", title: "5. Oś czasu (Gantt), Roadmapa, Kalendarz", items: [
    { title: "Oś czasu", desc: "Zadania i milestone'y na osi czasu. Lewa część to lista z rozwijaniem, prawa - paski w skali tygodni, miesięcy lub kwartałów z linią „dziś”.",
      can: ["Rozwijanie milestone'ów i zadań podrzędnych pod zadaniem głównym", "Zależności między zadaniami rysowane strzałkami", "Zmiana skali: tygodnie / miesiące / kwartały, przycisk Dzisiaj", "Filtry po milestone'ie i kategorii statusu", "Zaznaczanie zadań do akcji masowych", "Tworzenie zadania bezpośrednio z widoku"],
      how: [["Pokazanie zależności", ["W panelu zadania, w sekcji Powiązane zadania, kliknij Powiąż i wybierz zadanie, które zależy od bieżącego", "Na Osi czasu strzałka połączy oba paski"]]],
      imgs: [img("12-gantt", "Oś czasu ze zwiniętymi milestone'ami"), img("12a-gantt-rozwiniety", "Rozwinięte milestone'y, zadania podrzędne i zależności"), img("12b-gantt-miesiace", "Skala miesięczna"), img("12c-gantt-filtr-milestone", "Filtr po milestone'ie")] },
    { title: "Roadmapa i milestone'y", desc: "Milestone to etap projektu z datą początku i końca oraz odpowiedzialną osobą. Roadmapa pokazuje milestone'y jako paski lub jako markery (kropki z liczbą zadań i strzałkami kolejności).",
      can: ["Tworzenie milestone'ów z opisem i osobą odpowiedzialną", "Tryb Paski i tryb Markery", "Tablica zbiorcza: milestone'y z innych tablic", "Postęp zadań (zrobione/wszystkie) na każdym milestone'ie", "Własne milestone'y per widok własny"],
      how: [["Nowy milestone", ["Na Roadmapie kliknij + Nowy milestone", "Podaj tytuł, daty, osobę i opis", "Przypisz zadania do milestone'u w panelu zadania (sekcja Plan → Milestone)"]]],
      imgs: [img("13-roadmapa", "Roadmapa - tryb pasków"), img("13a-roadmapa-markery", "Roadmapa - tryb markerów"), img("13b-roadmapa-nowy-milestone", "Tworzenie milestone'u")] },
    { title: "Kalendarz tablicy", desc: "Zadania z datami rozłożone na miesiąc. Kliknięcie w zadanie otwiera jego panel.", can: ["Nawigacja po miesiącach", "Kolor według statusu"], how: [], imgs: [img("14-kalendarz", "Kalendarz tablicy")] },
  ] },
  { id: "inne-widoki", title: "6. Pozostałe widoki tablicy", items: [
    { title: "Podsumowanie", desc: "Pulpit tablicy: liczby zadań według statusów i priorytetów, obciążenie zespołu, postęp milestone'ów i ostatnia aktywność.", can: ["Statusy i priorytety", "Obciążenie zespołu (zadania per osoba)", "Milestone'y z postępem", "Ostatnia aktywność"], how: [], imgs: [img("17-podsumowanie", "Podsumowanie tablicy")] },
    { title: "Opis tablicy", desc: "Strona z dowolną treścią: cel projektu, zasady, zakres. Edytor z nagłówkami, listami, cytatami.", can: ["Formatowanie tekstu", "Wspólna edycja przez zespół"], how: [], imgs: [img("18-opis", "Opis tablicy")] },
    { title: "Whiteboard tablicy", desc: "Tablica rysunkowa powiązana z tablicą zadań - schematy, mapy myśli, diagramy. Węzły można podpinać do zadań.", can: ["Kształty, przyklejane notatki, tekst, rysowanie odręczne", "Szablony (flowchart, mindmap, retro i inne)", "Podpinanie zadań do węzłów", "Wspólna edycja na żywo"], how: [], imgs: [img("15-whiteboard", "Whiteboard tablicy")] },
    { title: "Linia zadań", desc: "Widok procesowy: zadanie przechodzi etapy od lewej do prawej. Etapy definiujesz sami, karty przeciągasz między etapami.", can: ["Własne etapy", "Kilka linii na tablicy"], how: [], imgs: [img("16-taskline", "Linia zadań")] },
    { title: "Widoki własne", desc: "Oprócz widoków domyślnych tworzysz dowolną liczbę własnych (np. „Lista - tylko moje”, „Kanban - Media”). Każdy ma własną konfigurację filtrów, kolumn i grupowania; widok Roadmapa/Oś czasu może mieć własne milestone'y.",
      can: ["Dowolna liczba widoków każdego typu", "Własna nazwa i tło", "Zadanie można dodać do wybranego widoku (sekcja Widoki w panelu zadania)"],
      how: [["Nowy widok", ["Kliknij + na końcu zakładek widoków", "Wybierz typ i nadaj nazwę", "Ustaw filtry - konfiguracja zapisze się dla tego widoku"]]],
      imgs: [img("10s-nowy-widok", "Tworzenie widoku własnego")] },
  ] },
  { id: "zadania", title: "7. Zadania", items: [
    { title: "Tworzenie zadania", desc: "Zadanie tworzysz z każdego widoku: przyciskiem Nowe zadanie (pełny formularz), wierszem „Dodaj zadanie” w Liście, przyciskiem w kolumnie Kanbana, skrótem C albo z menu Utwórz.",
      can: ["Formularz: tytuł, tablica, status, priorytet, termin, osoby, milestone, widok", "„Utwórz i dodaj kolejne” (Shift+Enter) do seryjnego wpisywania", "Numer zadania nadawany automatycznie w obrębie tablicy"],
      how: [["Seria zadań po spotkaniu", ["Naciśnij C", "Wpisz tytuł i naciśnij Shift+Enter - zadanie zapisze się, a formularz zostanie otwarty na kolejne"]]],
      imgs: [img("10r-nowe-zadanie-dialog", "Formularz nowego zadania")] },
    { title: "Panel zadania", desc: "Zadanie otwiera się jako panel boczny nad listą (lista pozostaje aktywna - klik w inny wiersz podmienia zadanie), jako okno na środku (z wyszukiwarki i powiadomień) albo jako pełna strona. Szerokość panelu zmieniasz przeciągając jego lewą krawędź.",
      can: ["Trzy tryby: panel, okno, pełna strona; pełny ekran na telefonie", "Lewa kolumna: opis, podzadania, zadania podrzędne, załączniki, powiązane zadania, głosowanie, aktywność", "Prawa kolumna Szczegóły: osoby, terminy, plan, czas pracy, pola dodatkowe", "Przypinanie pól do góry i ukrywanie pustych", "Wykrywanie równoległej edycji przez inną osobę"],
      how: [["Otwarcie w pełnym widoku", ["W nagłówku panelu kliknij ikonę strzałek (Pełny widok) - zadanie otworzy się jako osobna strona z własnym adresem, który możesz wysłać koledze"]]],
      imgs: [img("22-panel-zadania", "Panel boczny zadania nad listą"), img("22o-panel-modal", "Zadanie w oknie"), img("20-zadanie-pelna-strona", "Pełna strona zadania"), img("22r-panel-pola-dodatkowe", "Pola dodatkowe i przypinanie pól"), img("22m-panel-wiecej", "Menu Więcej: kopiowanie linku, usuwanie")] },
    { title: "Status, priorytet, osoby, tagi", desc: "Podstawowe atrybuty zmieniasz z chipów w nagłówku i z prawej kolumny. Priorytety P0 (pilny) - P3 (niski) mają skróty klawiszowe.",
      can: ["Status z kolumn tablicy", "Priorytet P0-P3 lub brak", "Wielu przypisanych, wyszukiwanie osób", "Tagi wspólne dla przestrzeni z kolorami, tworzenie nowych w locie"],
      how: [["Przypisanie osoby", ["W sekcji Osoby kliknij +", "Wpisz fragment imienia i wybierz osobę - dostanie powiadomienie"]]],
      imgs: [img("22a-panel-status", "Zmiana statusu"), img("22b-panel-priorytet", "Zmiana priorytetu ze skrótami P0-P3"), img("22c-panel-przypisani", "Przypisywanie osób"), img("22e-panel-tagi", "Dodawanie tagów")] },
    { title: "Terminy, przypomnienia, cykliczność", desc: "Zadanie ma datę startu i końca. Możesz ustawić przypomnienie względem terminu oraz cykliczność - kolejne wystąpienia tworzą się automatycznie (codziennie, co tydzień w wybrany dzień, co miesiąc).",
      can: ["Start i koniec z godziną", "Przypomnienie: 15 min, 1 h, 1 dzień przed lub własne", "Cykliczność dzienna / tygodniowa / miesięczna", "Przeterminowane terminy wyróżnione czerwienią na listach"],
      how: [["Raport co piątek", ["Ustaw termin zadania na najbliższy piątek", "W polu Cykliczność wybierz Co tydzień i dzień: piątek", "Po zamknięciu zadania system utworzy kolejne wystąpienie na następny piątek"]]],
      imgs: [img("22p-panel-data", "Wybór daty"), img("22g-panel-przypomnienie", "Przypomnienie o terminie"), img("22f-panel-cyklicznosc", "Cykliczność zadania"), img("22d-panel-milestone", "Przypisanie do milestone'u")] },
    { title: "Opis, podzadania i zadania podrzędne", desc: "Opis to edytor tekstu z formatowaniem (nagłówki, listy, cytaty, kod, linki, emoji). Podzadania to lekka checklista wewnątrz zadania. Zadania podrzędne to pełnoprawne zadania z własnym numerem i statusem, widoczne pod zadaniem głównym w Osi czasu - jak epik i jego zadania.",
      can: ["Checklista z paskiem postępu", "Zadania podrzędne z własnym statusem, osobami i terminami", "Link do zadania nadrzędnego w nagłówku zadania podrzędnego"],
      how: [["Rozbicie dużego zadania", ["Otwórz zadanie główne", "W sekcji Zadania podrzędne kliknij Nowe zadanie podrzędne i wpisz tytuł", "Powtórz dla kolejnych; każde otworzysz osobno i przypiszesz innej osobie", "Na Osi czasu rozwiń zadanie główne, aby zobaczyć podrzędne pod nim"]]],
      imgs: [img("21-zadanie-epik", "Zadanie główne z listą zadań podrzędnych"), img("23-glosowanie", "Zadanie podrzędne z linkiem do nadrzędnego, podzadaniami i głosowaniem")] },
    { title: "Załączniki, powiązania, głosowanie", desc: "Do zadania wgrywasz pliki (obrazy mają miniatury), łączysz je z innymi zadaniami (także z innych tablic) i uruchamiasz głosowanie dla zespołu.",
      can: ["Przeciągnij i upuść pliki, limity rozmiaru per typ", "Powiązania dwukierunkowe, widoczne jako zależności w Osi czasu", "Głosowanie z dowolną liczbą opcji, jeden głos na osobę, zamykanie głosowania"],
      how: [["Głosowanie nad wariantem", ["Kliknij Utwórz głosowanie", "Wpisz pytanie i opcje", "Zespół głosuje w panelu; wynik widać na pasku przy każdej opcji"]]],
      imgs: [img("22n-panel-powiaz", "Wybór zadania do powiązania"), img("22q-panel-glosowanie-nowe", "Tworzenie głosowania")] },
    { title: "Komentarze, historia, czas pracy", desc: "Sekcja Aktywność na dole zadania ma zakładki: Wszystko, Komentarze, Historia (każda zmiana z autorem i czasem), Czas pracy (wpisy timera).",
      can: ["Komentarze z formatowaniem i emoji", "Wzmianki @osoba - wspomniana osoba dostaje powiadomienie", "Pełna historia zmian pól", "Timer: Start / Pauza / Zakończ zapisuje wpis czasu; suma czasu na zadaniu"],
      how: [["Mierzenie czasu", ["W sekcji Czas pracy kliknij Start", "Po skończeniu kliknij Zakończ - wpis trafia do Czasu pracy przestrzeni i do raportów"]]],
      imgs: [img("22h-panel-komentarze", "Komentarze ze wzmiankami"), img("22i-panel-historia", "Historia zmian"), img("22j-panel-czas", "Wpisy czasu pracy w zadaniu")] },
    { title: "Wysyłka mailem i przenoszenie", desc: "Zadanie wysyłasz e-mailem (z krótką notką) do osoby z zespołu lub spoza aplikacji, przenosisz na inną tablicę lub kopiujesz link.",
      can: ["Wysyłka e-mailem z treścią zadania", "Przenoszenie między tablicami w przestrzeni", "Kopiowanie linku, usuwanie"],
      how: [], imgs: [img("22k-panel-wyslij-mailem", "Wysyłka zadania mailem"), img("22l-panel-przenies", "Przenoszenie zadania na inną tablicę")] },
  ] },
  { id: "dla-ciebie", title: "8. Dla Ciebie - Twoje osobiste miejsce", items: [
    { title: "Powiadomienia", desc: "Skrzynka wszystkich zdarzeń, które Cię dotyczą: przypisania, wzmianki, zmiany statusu, nowe zadania, głosowania, zgłoszenia. Nowe powiadomienia pojawiają się na żywo jako toast.",
      can: ["Zakładki: Nieprzeczytane, Wzmianki, Przypisania, Wszystkie", "Akcje z poziomu powiadomienia: Otwórz zadanie, Przesuń termin", "Własna notatka do powiadomienia", "Oznacz wszystkie jako przeczytane"], how: [],
      imgs: [img("50-powiadomienia", "Powiadomienia")] },
    { title: "Zadania dla Ciebie", desc: "Wszystkie zadania przypisane do Ciebie ze wszystkich przestrzeni, pogrupowane według terminów.", can: ["Licznik w pasku bocznym", "Przejście do zadania jednym kliknięciem"], how: [], imgs: [img("51-zadania-dla-ciebie", "Zadania dla Ciebie")] },
    { title: "TO DO", desc: "Prywatna lista rzeczy do zrobienia - niewidoczna dla nikogo innego. Foldery, listy, pozycje z krokami, terminami, oznaczeniem Ważne i widokiem Mój dzień.",
      can: ["Foldery i listy", "Kroki wewnątrz pozycji", "Termin i przypomnienie", "Mój dzień, Ważne, Zaplanowane", "Przeciągnięcie pozycji na zadanie w tablicy, aby ją podpiąć"], how: [],
      imgs: [img("52-todo", "TO DO"), img("52a-todo-szczegoly", "Szczegóły pozycji z krokami")] },
    { title: "Kalendarz osobisty", desc: "Twoje zadania ze wszystkich przestrzeni, przypomnienia i urlopy zespołu w jednym kalendarzu. Widoki: dzień, tydzień, miesiąc.", can: ["Zakres: dzień / tydzień / miesiąc", "Filtry: przydzielone do mnie, terminy zadań, urlopy zespołu"], how: [], imgs: [img("53-kalendarz-osobisty", "Kalendarz osobisty")] },
    { title: "Notatnik", desc: "Prywatne notatki z formatowaniem, folderami i przypinaniem.", can: ["Foldery", "Przypinanie", "Wyszukiwanie", "Link do notatki (otworzy tylko Twoje konto)"], how: [], imgs: [img("54-notatnik", "Notatnik"), img("54a-notatka", "Edycja notatki")] },
    { title: "Przypomnienia", desc: "Przypomnienia dla siebie i dla innych osób. W terminie pojawia się okno w aplikacji i e-mail.", can: ["Dla mnie / wysłane przeze mnie", "Schowanie przypomnienia od innej osoby (nadawca dalej je widzi)", "Porządkowanie minionych"], how: [], imgs: [img("55-przypomnienia", "Przypomnienia"), img("55a-przypomnienie-nowe", "Nowe przypomnienie")] },
    { title: "Urlopy", desc: "Wnioski urlopowe z akceptacją przez administratora. Statusy: Czeka, Zatwierdzony, Odrzucony, Anulowany. Zatwierdzone urlopy widać w kalendarzu i w Czasie pracy.",
      can: ["Wniosek z zakresem dat i powodem", "Decyzja z komentarzem", "Podgląd urlopów zespołu"], how: [["Złożenie wniosku", ["Wejdź w Urlopy i kliknij Nowy wniosek", "Wybierz daty i wpisz powód", "Administrator dostanie powiadomienie; decyzję zobaczysz na liście"]]],
      imgs: [img("56-urlopy", "Urlopy"), img("56a-urlop-nowy", "Nowy wniosek")] },
  ] },
  { id: "narzedzia", title: "9. Narzędzia przestrzeni", items: [
    { title: "Kontakty (CRM)", desc: "Baza firm i osób kontaktowych z danymi rejestrowymi (NIP, REGON, VAT EU), adresem, opiekunem i notatkami. Karta kontaktu zbiera aktywność, wiadomości, deale i zadania.",
      can: ["Import kontaktów z CSV", "Opiekun kontaktu i filtr „bez opiekuna”", "Oś czasu aktywności i notatki", "Wiadomości e-mail przypisane do kontaktu", "Deale i zadania powiązane z kontaktem", "Kosz z przywracaniem"],
      how: [["Nowy kontakt", ["Kontakty → Nowy kontakt", "Wypełnij osobę, firmę i adres", "Wybierz opiekuna - kontakt pojawi się na jego liście"]]],
      imgs: [img("30-kontakty", "Lista kontaktów"), img("31-kontakt", "Karta kontaktu"), img("30a-nowy-kontakt", "Formularz nowego kontaktu")] },
    { title: "Plan sprzedaży", desc: "Lejek sprzedaży: deale przechodzą etapy od Lead do Wygrane lub Przegrane. Pipeline pokazuje karty w kolumnach etapów, Prognoza - wartości i najbliższe zamknięcia per etap.",
      can: ["Własne etapy z kolorami i typem (otwarty / wygrany / przegrany)", "Wartość, waluta, planowana data zamknięcia, właściciel, kontakt", "Przeciąganie kart między etapami", "Przypomnienia o dealu", "Oś czasu deala: zmiany etapu, wartości, notatki"],
      how: [["Zamknięcie deala", ["Otwórz deal", "Kliknij Zamknij jako wygrane (lub przegrane) - deal trafi do odpowiedniego etapu, a wartość do statystyk „Wygrane”"]]],
      imgs: [img("32-sprzedaz", "Pipeline"), img("32a-prognoza", "Prognoza"), img("32b-etapy", "Konfiguracja etapów"), img("33-deal", "Karta deala"), img("32c-nowy-deal", "Nowy deal")] },
    { title: "Czas pracy", desc: "Wpisy z timera i wpisy ręczne w siatce tygodnia per osoba. Stawki godzinowe (globalne i per osoba) pozwalają liczyć wartość pracy; raporty grupują czas według osoby, tablicy i zadania.",
      can: ["Mój czas / Zespół / Raport", "Wpisy ręczne z notatką i flagą „do faktury”", "Aktywny timer widoczny w nagłówku", "Eksport", "Raporty: wg osoby, wg tablicy, wg zadania, z wartością w złotówkach"],
      how: [["Wpis ręczny", ["Czas pracy → Dodaj wpis ręcznie", "Wybierz zadanie (opcjonalnie), godziny od-do i notatkę", "Wpis pojawi się w siatce i w raportach"]]],
      imgs: [img("34-czas", "Czas pracy - zespół"), img("34a-czas-moj", "Mój czas"), img("34c-czas-wpis-recznie", "Wpis ręczny"), img("35-czas-raporty", "Raporty czasu pracy")] },
    { title: "Hasła", desc: "Sejf na hasła zespołu. Hasła są szyfrowane w bazie (AES-256-GCM) i odsłaniane na żądanie na 30 sekund. Odczyt i zarządzanie wymagają odpowiedniej roli.",
      can: ["Usługa, adres, login, hasło, notatka (też szyfrowana), kategoria", "Odsłanianie na 30 s i kopiowanie do schowka", "Kto ma dostęp - widoczne w tabeli", "Wyszukiwanie"],
      how: [["Odsłonięcie hasła", ["Kliknij ikonę oka w wierszu", "Hasło jest widoczne przez 30 sekund, potem znika automatycznie", "Ikona obok kopiuje hasło bez pokazywania go"]]],
      imgs: [img("36-hasla", "Sejf haseł"), img("36a-haslo-odslon", "Odsłonięte hasło z odliczaniem"), img("36b-haslo-nowy", "Nowy wpis")] },
    { title: "Subskrypcje", desc: "Rejestr kosztów cyklicznych (miesięcznych i rocznych) z podziałem na projekty. Widoczność kosztów kontrolują członkowie projektu.",
      can: ["Kwota, cykl, adres, notatka", "Projekty z listą członków", "Filtr projektu i sumy"], how: [],
      imgs: [img("37-subskrypcje", "Subskrypcje"), img("37a-subskrypcja-nowa", "Nowa subskrypcja")] },
    { title: "Creative Board", desc: "Tablica pomysłów i briefów kreatywnych. Każdy pomysł ma emoji, kolor, status (szkic, w review, zaakceptowany, zrealizowany) i treść z szablonu briefu.",
      can: ["Filtr statusów, sortowanie najnowsze / najpopularniejsze", "Szablony briefu", "Edytor treści"], how: [],
      imgs: [img("38-briefy", "Creative Board"), img("38a-brief", "Brief kreatywny")] },
    { title: "Support", desc: "Zgłoszenia wewnętrzne: kolejki Otwarte, W obsłudze, Rozwiązane, Zamknięte, priorytety i termin. Osoba przypisana dostaje powiadomienie.",
      can: ["Priorytet Niski / Średni / Wysoki / Pilny", "Przypisanie do osoby, termin", "Załączniki", "Licznik otwartych w pasku bocznym"], how: [],
      imgs: [img("39-support", "Support"), img("39a-support-zgloszenie", "Szczegóły zgłoszenia"), img("39b-support-nowe", "Nowe zgłoszenie")] },
    { title: "Wiki", desc: "Strona wiedzy przestrzeni: zasady, procesy, onboarding. Edycja dla uprawnionych, spis treści z nagłówków.", can: ["Formatowanie", "Spis „Na tej stronie”"], how: [], imgs: [img("40-wiki", "Wiki")] },
    { title: "Whiteboardy", desc: "Tablice rysunkowe niezależne od tablic zadań: procesy, ścieżki klienta, mapy myśli. Kilka osób może rysować jednocześnie (tryb live).",
      can: ["Kształty: prostokąt, koło, romb, notatka, ramka, tekst; rysowanie odręczne", "Połączenia z etykietami, styl linii", "Szablony: Mindmap, Flowchart, User flow, Wireframe, Retro, Macierz Eisenhowera, Lean Canvas, Diagram Ishikawy, Customer Journey, Kanban, MVP Launch", "Wklejanie obrazów, eksport PNG, minimapa", "Pula zadań: podpinanie zadań do węzłów", "Timer do sesji warsztatowych"],
      how: [["Warsztat z szablonu", ["Whiteboardy → Nowy whiteboard", "W menu ⋯ na dole wybierz szablon (np. Retro)", "Zaproś zespół - zmiany widoczne u wszystkich na żywo"]]],
      imgs: [img("41-whiteboardy", "Lista whiteboardów"), img("42-canvas", "Whiteboard: ścieżka klienta"), img("42a-canvas-szablony", "Szablony i eksport")] },
    { title: "Dokumenty", desc: "Pliki przestrzeni z dostępem dla wybranych osób. Dokument widzi administrator, osoba wgrywająca i osoby z listy dostępu.",
      can: ["Wgrywanie plików", "Lista osób z dostępem", "Pobieranie", "Wyszukiwanie"],
      how: [["Udostępnienie umowy tylko jednej osobie", ["Dokumenty → Dodaj dokument", "Wybierz plik i zaznacz osobę, która ma go widzieć", "Pozostali członkowie nie zobaczą pliku na liście"]]],
      imgs: [img("43-dokumenty", "Dokumenty"), img("43a-dokument-dodaj", "Dodawanie dokumentu z listą dostępu")] },
    { title: "Umowy", desc: "Rejestr umów z dowolnymi polami „Szczegóły umowy” (np. kontrahent, czas trwania, rabat, okres wypowiedzenia) - pola definiujesz przy wpisie.",
      can: ["Własne pary etykieta - wartość", "Wyszukiwanie"], how: [], imgs: [img("44-umowy", "Umowy"), img("44a-umowa-nowa", "Nowa umowa z polami własnymi")] },
    { title: "Zapotrzebowanie", desc: "Zgłoszenia zakupowe: projekt, link do produktu, koszt, zgłaszający. Suma na dole tabeli.", can: ["Link tylko http(s)", "Koszt w PLN", "Suma"], how: [], imgs: [img("45-zapotrzebowanie", "Zapotrzebowanie"), img("45a-zapotrzebowanie-nowe", "Nowe zgłoszenie")] },
    { title: "Kalendarz przestrzeni", desc: "Zadania z datami ze wszystkich tablic przestrzeni oraz wydarzenia przestrzeni (spotkania, sesje, terminy klienta) z kolorami.", can: ["Wydarzenia całodniowe i godzinowe", "Kolor wydarzenia"], how: [], imgs: [img("46-kalendarz-przestrzeni", "Kalendarz przestrzeni"), img("46a-kalendarz-wydarzenie", "Nowe wydarzenie")] },
  ] },
  { id: "ai", title: "10. Ateron AI", items: [
    { title: "Asystent przestrzeni", desc: "Ateron odpowiada na pytania o dane w Twojej przestrzeni: jakie są tablice, co jest przeterminowane, ile zadań ma dany status, co robiła dana osoba. Ma dostęp tylko do danych, do których masz dostęp Ty.",
      can: ["Rozmowy zapisywane per użytkownik", "Podpowiedzi startowe", "Wyłącznik globalny w panelu administratora"],
      how: [["Pytanie o stan projektu", ["Kliknij Zapytaj AI w pasku górnym", "Wpisz np. „Co jest przeterminowane w Kampanii Q4?”", "Ateron odczyta dane z tablicy i odpowie listą zadań"]]],
      imgs: [img("75-ateron-ai", "Panel Ateron AI")] },
  ] },
  { id: "mobile", title: "11. Wersja mobilna", items: [
    { title: "Telefon i tablet", desc: "Cała aplikacja działa na telefonie: pasek boczny jako szuflada, widoki dopasowane do wąskiego ekranu, panel zadania na pełny ekran, listy i menu jako dolne arkusze.",
      can: ["Lista, Kanban, Oś czasu, Kalendarz na telefonie", "Panel zadania pełnoekranowy z komentarzami", "Powiadomienia i narzędzia"], how: [],
      imgs: [img("90-mobile-lista", "Lista na telefonie"), img("91-mobile-menu", "Menu (szuflada)"), img("92-mobile-panel", "Zadanie na telefonie"), img("93-mobile-kanban", "Kanban na telefonie"), img("94-mobile-gantt", "Oś czasu na telefonie"), img("95-mobile-powiadomienia", "Powiadomienia na telefonie")] },
  ] },
  { id: "admin", title: "12. Administracja i bezpieczeństwo", items: [
    { title: "Panel administratora", desc: "Dostępny dla super-administratora: użytkownicy (dodawanie, reset hasła, blokowanie), przestrzenie, flagi funkcji (np. wyłączenie AI lub linków publicznych), dziennik audytu wszystkich zmian, kopie zapasowe przestrzeni i akcje serwisowe.",
      can: ["Użytkownicy: dodaj, zmień hasło, zablokuj", "Przestrzenie: podgląd, statystyki", "Flagi systemowe (wyłączniki funkcji)", "Audyt: kto, co, kiedy - z podglądem zmian", "Kopie zapasowe: automatyczne i na żądanie"], how: [],
      imgs: [img("60-admin", "Panel administratora"), img("61-admin-uzytkownicy", "Użytkownicy"), img("62-admin-audyt", "Dziennik audytu"), img("63-admin-flagi", "Flagi systemowe"), img("64-admin-backupy", "Kopie zapasowe")] },
    { title: "Bezpieczeństwo", desc: "Uprawnienia sprawdzane po stronie serwera przy każdej akcji; ukryty adres logowania i limit prób; weryfikacja dwuetapowa; hasła w sejfie szyfrowane AES-256-GCM; dziennik audytu każdej zmiany; automatyczne kopie zapasowe; aktualizacje na żywo przez bezpieczne kanały per przestrzeń.",
      can: [], how: [], imgs: [] },
  ] },
];

for (const s of sections) for (const i of s.items) for (const im of i.imgs) await figSrc(im.name);
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const toc = sections.map((s) => `<li><a href="#${s.id}">${esc(s.title)}</a><ul>${s.items.map((i) => `<li>${esc(i.title)}</li>`).join("")}</ul></li>`).join("");
const body = sections.map((s) => `<section class="chapter" id="${s.id}"><h1>${esc(s.title)}</h1>${s.items.map((i) => `
  <article>
    <h2>${esc(i.title)}</h2>
    <p class="lead">${esc(i.desc)}</p>
    <div class="boxes">${i.can.length ? `<div class="box"><h3>Co możesz zrobić</h3><ul>${i.can.map((c) => `<li>${esc(c)}</li>`).join("")}</ul></div>` : ""}${i.how.map(([t, steps]) => `<div class="box how"><h3>Jak to zrobić: ${esc(t)}</h3><ol>${steps.map((st) => `<li>${esc(st)}</li>`).join("")}</ol></div>`).join("")}</div>
    ${i.imgs.length ? fig(i.imgs[0], "hero") : ""}
    ${(() => { const rest = i.imgs.slice(1); const odd = rest.length % 2 ? rest.pop() : null; return (rest.length ? `<div class="grid">${rest.map((im) => fig(im)).join("")}</div>` : "") + (odd ? fig(odd, "hero") : ""); })()}
  </article>`).join("")}</section>`).join("");

const total = sections.reduce((a, s) => a + s.items.reduce((b, i) => b + i.imgs.length, 0), 0);
const html = `<!doctype html><html lang="pl"><head><meta charset="utf-8"><title>FLOVLY - przewodnik po funkcjach</title>
<style>
  @page { size: A4 landscape; margin: 14mm 14mm 16mm 14mm; }
  body { font-family: -apple-system, "Inter", "Helvetica Neue", Arial, sans-serif; color: #1C1A17; font-size: 10pt; line-height: 1.45; margin: 0; }
  .cover { height: 175mm; display: flex; flex-direction: column; justify-content: center; break-after: page; }
  .cover .dot { width: 22mm; height: 22mm; border-radius: 50%; background: #FF5C00; margin-bottom: 10mm; }
  .cover h1 { font-size: 34pt; margin: 0 0 3mm; letter-spacing: -0.02em; }
  .cover p { color: #6b665e; font-size: 12pt; margin: 0; }
  .toc { break-after: page; } .toc h1 { font-size: 20pt; } .toc ul { columns: 2; column-gap: 14mm; padding-left: 5mm; margin: 0; } .toc li { break-inside: avoid; margin-bottom: 1.5mm; } .toc li ul { columns: 1; color: #6b665e; font-size: 9pt; margin: 1mm 0 2mm; } .toc a { color: inherit; text-decoration: none; font-weight: 600; }
  .chapter { break-before: page; }
  h1 { font-size: 20pt; margin: 0 0 6mm; padding-bottom: 2mm; border-bottom: 2pt solid #FF5C00; letter-spacing: -0.01em; }
  /* Moduly plyna jeden po drugim (bez wymuszonych lamań) - lamanie tylko przed rozdzialem. */
  article { margin-top: 9mm; }
  article:first-of-type { margin-top: 0; }
  h2 { font-size: 15pt; margin: 0 0 2mm; break-after: avoid; } .lead { margin: 0 0 4mm; font-size: 10.5pt; }
  .boxes { display: grid; grid-template-columns: 1fr 1fr; gap: 3mm 4mm; margin-bottom: 3mm; break-inside: avoid; }
  .boxes:has(> :only-child) { grid-template-columns: 1fr; }
  .box { border: 1pt solid #E6E3DE; border-radius: 3mm; padding: 3mm 4mm; margin: 0; break-inside: avoid; font-size: 9.5pt; }
  .box.how { border-color: #FFC7A6; background: #FFF4EE; }
  .box h3 { margin: 0 0 1.5mm; font-size: 9.5pt; text-transform: uppercase; letter-spacing: .06em; color: #B83F00; }
  .box ul, .box ol { margin: 0; padding-left: 5mm; } .box li { margin-bottom: 0.8mm; }
  /* Pierwszy zrzut modułu: duży, na stronie z tekstem (max 100 mm wysokości). Kolejne: siatka 2 kolumny, 4 na stronę. */
  figure { margin: 4mm 0 0; break-inside: avoid; }
  figure img { display: block; width: auto; max-width: 100%; max-height: 85mm; margin: 0 auto; border: 1pt solid #E6E3DE; border-radius: 2mm; }
  figure.hero figcaption { text-align: center; }
  /* 124 mm szerokosci = 77,5 mm wysokosci przy 16:10 -> dwa rzedy (4 zrzuty) na stronie A4 poziomej. */
  .grid { display: grid; grid-template-columns: 124mm 124mm; justify-content: space-between; gap: 4mm 8mm; margin-top: 4mm; }
  .grid figure { margin: 0; } .grid figure img { width: 100%; max-height: none; }
  figcaption { font-size: 8pt; color: #6b665e; margin-top: 1mm; line-height: 1.3; }
</style></head><body>
<div class="cover"><div class="dot"></div><h1>FLOVLY</h1><p>Przewodnik po funkcjach - co umożliwia aplikacja i jak z tego korzystać</p><p style="margin-top:6mm;font-size:10pt">Stan aplikacji na 9 września 2026 · ${total} zrzutów ekranu · dane przykładowe przestrzeni „Agencja Nova”</p></div>
<div class="toc"><h1>Spis treści</h1><ul>${toc}</ul></div>
${body}
</body></html>`;
writeFileSync(resolve(here, "FLOVLY-funkcje.html"), html);

const b = await puppeteer.launch();
const p = await b.newPage();
await p.goto(`file://${resolve(here, "FLOVLY-funkcje.html")}`, { waitUntil: "load" });
await p.pdf({ path: resolve(here, "FLOVLY-przewodnik-po-funkcjach.pdf"), format: "A4", landscape: true, printBackground: true, displayHeaderFooter: true, headerTemplate: "<span></span>", footerTemplate: '<div style="width:100%;font-size:8px;color:#8A857D;text-align:center;font-family:Helvetica,Arial">FLOVLY - przewodnik po funkcjach · strona <span class="pageNumber"></span> z <span class="totalPages"></span></div>', margin: { top: "12mm", bottom: "14mm", left: "14mm", right: "14mm" } });
await b.close();
console.log("OK", total, "zrzutów");
