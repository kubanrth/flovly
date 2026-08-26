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
