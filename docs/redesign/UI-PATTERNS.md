# UI-PATTERNS — research → decisions

What we copy from Jira (2025 nav), Airtable and Linear, and how it maps onto our data model. "Take" = build it. "Skip" = explicitly not.

## A. Jira — new navigation (rolled out 2025)

Source: `inspo/jira-new-navigation.png`, `jira-2025-ui-*.png`, client screenshot (SL board / Oś czasu).

| Pattern | Take | Mapping |
|---|---|---|
| **Top bar 48px**: sidebar-toggle · app-switcher · logo · global search (wide) · `+ Create` primary · notifications · help · settings · avatar | ✓ | Search = cmdk (Cmd+K); `+ Utwórz` = orange primary opening create menu (Zadanie / Tablica / Przestrzeń / Kontakt / Deal / Notatka) |
| **Sidebar sections**: For you · Recent › · Starred › · Apps · Plans · **Projects** (Starred / Recent / View all) · Roadmaps · Dashboards · Assets · Goals · More (Operations, Filters, Teams, **Customize sidebar**) | ✓ (adapted) | Dla Ciebie (Powiadomienia, Zadania dla Ciebie, TO DO, Kalendarz, Notatnik, Przypomnienia, Urlopy) · Ostatnie · Oznaczone · **Przestrzenie** (→ tablice) · Narzędzia (Kontakty, Plan sprzedaży, Czas pracy, Hasła, Subskrypcje, Creative Board, Support, Wiki) · Więcej / Dostosuj pasek |
| Active project row: light tint bg + 2px left rail in brand color | ✓ | orange-50 bg + orange-500 rail |
| Sidebar collapses to icon rail; "Get help with navigation" footer | ✓ rail / ✗ footer | footer = user card + theme |
| **Project header**: breadcrumb `Projects / Mobile app` · h1 + `…` · **horizontal tabs** with icons (Summary · Timeline · Backlog · Board · Calendar · Reports ▾ · Code · More `6`) underline active | ✓ | `Przestrzeń / Tablica` · h1 · tabs: Podsumowanie · Lista · Tablica · Oś czasu · Roadmapa · Kalendarz · Whiteboard · Linia zadań · Opis · `+` · `Więcej N` |
| Toolbar under tabs: search field · avatar stack filter · Filter ▾ / Epic ▾ / Type ▾ / Label ▾ / Quick filters ▾ · right: view settings ⚙ · `…` | ✓ | search · assignee avatars (click = filter) · filter chips (Status / Priorytet / Tag / Przypisany / Data) · right: Grupuj · Sortuj · Kolumny · Gęstość · `…` |
| **Timeline** (client screenshot): left frozen table (checkbox, ›expand, key, title, progress bar under title) · right time grid (months) · today line · bars · `+ Create Epic` inline row · bottom-right zoom `Dzisiaj | Tygodnie | Miesiące | Kwartały` | ✓ 1:1 | Oś czasu = tasks (and milestones as parents). Progress bar = subtasks done %. Epics ≈ milestones; child rows ≈ tasks in milestone. |
| **Board**: column headers `TO DO 6` uppercase + count · flat cards (title, chips, key, priority icon, avatar) · `+ Create issue` at column bottom · Group by ▾ | ✓ | statusColumns; group by = assignee/priority swimlanes (new) |
| **Summary tab**: KPI row (completed / updated / created / due soon in 7 days) · Status overview donut · Priority breakdown bars · Types of work · Team workload · Recent activity | ✓ (new module) | "Podsumowanie" per board — compute from Task/Subtask/AuditLog |
| Work item view: 3 open modes (side panel / modal / full page), description-first left column, "Details" right column with hide-when-empty, pinned fields, activity tabs (All / Comments / History / Work log) | ✓ | Task panel — see PROMPT §3.4 |
| Blue as brand, dense icon bar, "Rovo" AI button | ✗ | orange; AI = Czesiek in `…` / Cmd+K, not a top-bar button |

## B. Airtable — grid & views

Source: `inspo/airtable-*.png`.

| Pattern | Take | Mapping |
|---|---|---|
| Grid: **field-type icon in every header**, primary field frozen, row number gutter, `+` add-field column, `+` add-row footer, drag-fill handle | ✓ (no drag-fill) | 16 FieldTypes from `lib/table-fields.ts` → lucide icon map; title = primary frozen |
| Toolbar: Views ▾ · Hide fields · Filter · Group · Sort · Color · Row height ▾ · Share | ✓ | Kolumny · Filtr · Grupuj · Sortuj · (Kolor = status color rail) · Gęstość |
| Filter builder: `Where [field] [operator] [value]` rows, AND/OR, chips summary | ✓ | 19 operators from `lib/table-filters.ts`; persisted per BoardView.configJson |
| Group by with collapsible group headers showing count + aggregate (sum/avg for number fields) | ✓ | groupBy + `lib/group-presets.ts`; aggregates for NUMBER/currency |
| Record expand (side sheet) with all fields editable; comments/activity inside | ✓ | = task side panel |
| View types: Grid, Kanban, Calendar, Gallery, Timeline, Gantt, List, Form; per-view config; Collaborative / Personal / Locked | ✓ types we have · ✗ Gallery/Form (out of 1:1 scope) · ✓ "Locked view" as `configLocked` later | custom BoardView per type already exists (K131/K134 scoping) |
| Pastel select-option colors with dark text | ✓ | palette §4 in DESIGN-TOKENS |
| Airtable's gradient marketing chrome | ✗ | — |

## C. Linear — polish & keyboard

| Pattern | Take | Mapping |
|---|---|---|
| Cmd+K command menu with contextual actions (on selected issue: assign, set status, priority…) | ✓ | extend existing `command-palette.tsx` (cmdk): global + row-context actions |
| Single-key shortcuts: `C` create, `E` edit/assign (we have `M`), `S` status, `P` priority, `/` filter, `J/K` move, `Enter` open, `Esc` close, `X` select | ✓ | document in `?` shortcut sheet |
| Dense list rows (36px), status icon left, ID mono, title, chips, avatars right, due date | ✓ | Lista/Tabela "comfortable" |
| Peek/side panel opens **without route change delay** (optimistic) | ✓ | intercepting route stays but render skeleton instantly (loading.tsx from K105) |
| "The best animation goes unnoticed" — 100–150ms fades, no bounce | ✓ | motion §8 |
| Dark-first, purple accents | ✗ | light-first, orange |

## D. Data-table hygiene (setproduct 2026 guide)

Take all: native `<table>` + `th scope`; keyboard nav (arrows/Home/End/PageUp/Down/Tab); live-region announcements for sort/filter; never color-only state; total count always visible ("128 zadań · 12 zaznaczonych"); active filters as chips with count + "Wyczyść"; sort arrows with direction; persisted column layout; deliberate empty/error/loading states; no hover-only actions for critical ops (row `…` menu always reachable via keyboard); sticky header + frozen first column with tested z-index; density modes; right-aligned numbers/currency.

## E. Explicit anti-patterns (from the current app — do not carry over)

Glass/blur surfaces · aura/mesh gradients · brand-gradient text · spring/overshoot easing · 22–36px radii · `-0.04em` tracking · mono uppercase eyebrows at `.14em` everywhere · violet-tinted shadows · pill segmented "liquid" view switcher · two-line hero cards in lists · white text on brand color · zoom lock is a client demand (WCAG 1.4.4 exception) — keep but isolate in one place.
