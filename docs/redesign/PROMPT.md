# REBUILD PROMPT — new UI for the FLOVLY codebase (Jira × Airtable × Linear, Marty Supreme orange)

> Paste this file as the opening prompt of a fresh Claude Code session started in `sites/danielos/`.
> Companion files in this folder are part of the prompt — read them first:
> `FUNCTIONAL-SPEC.md` (scope, 1:1 checklist) · `DESIGN-TOKENS.md` (colors/type/spacing, paste-ready `@theme`) · `UI-PATTERNS.md` (what to copy from Jira/Airtable/Linear) · `brand/` (mark, icons, palette) · `inspo/` (screenshots + README).

---

## 0. Mission

Rebuild the **entire UI layer** of an existing, working project-management SaaS (Polish-language, ClickUp-class feature set) so that it looks and behaves like a modern, dense, keyboard-first work tool in the spirit of **Jira's 2025 navigation**, **Airtable's grid**, and **Linear's polish**. Keep the backend exactly as it is. The client's verdict on the current UI is "functionally awful" — the new UI must be *boring, fast, obvious*. Brand color changes from violet to **Marty Supreme orange `#FF5C00`** on a white / warm-neutral base. The product will be renamed (name unknown yet): the app name comes from `NEXT_PUBLIC_APP_NAME` (fallback `"APP"`), and the logo is a universal orange-sphere mark (`brand/mark.svg`, variant A "cut"). Light theme is default; dark theme (pure black) is an option.

You are expected to work autonomously through the phases in §8, verifying with screenshots on `http://localhost:3100` after each phase.

## 1. Non-negotiables

**Keep (do not edit):**
- `prisma/schema.prisma`, migrations, `lib/generated/**`
- `lib/**` — auth, permissions (`can`/`assertCan`, 43 actions), workspace-guard, realtime, storage, vault-crypto, rate-limit, audit, table-fields (16 FieldTypes), table-filters (19 operators), group-presets, board-views, z-index, pluralize, format-duration, yjs/*, schemas/*
- All server actions `app/**/actions.ts` and `app/**/*-actions.ts` (signatures + behavior). If a new view needs a new read, add a **new** file; do not modify existing actions.
- `app/api/**`, cron routes, `middleware.ts`, `instrumentation.ts`, Sentry config, `vercel.json`
- Route structure (paths) — including the intercepting modal route `app/(app)/w/[workspaceId]/@modal/(.)t/[taskId]`
- `components/layout/route-tracker.tsx` (return-to + scroll restore logic)
- Canvas engine internals: `components/canvas/canvas-editor.tsx` React-Flow/Yjs logic (you may restyle toolbars/controls/chrome and extract UI pieces, but not the document/sync model)
- Tiptap extension set in `components/task/rich-text-editor.tsx` (restyle only)

**Rewrite from scratch:**
- `app/globals.css` (replace entirely with the `@theme` from `DESIGN-TOKENS.md` §11 + base styles)
- `components/ui/**` (design-system primitives), `components/layout/**` (except route-tracker), `components/view/**`, `components/table/**`, `components/kanban/**`, `components/roadmap/**`, `components/calendar/**`, `components/task/**` (UI; keep action wiring), all module components (`members`, `contacts`, `sales`, `briefs`, `support`, `wiki`, `passwords`, `time`, `subscriptions`, `my/**`, `inbox`, `my-tasks`, `vacations`, `profile`, `workspaces`, `admin`, `czesiek`, `search`, `onboarding`, `notifications`, `reminders`, `brand`)
- Every `page.tsx` / `layout.tsx` / `loading.tsx` markup (data fetching stays; move fetch code into the new page files unchanged)
- `app/icon.svg`, `app/opengraph-image.tsx`, `app/layout.tsx` fonts/metadata

**Stack stays:** Next.js 16 App Router, React 19, TypeScript, Tailwind v4, `@base-ui/react` primitives, lucide-react, TanStack Table v8, dnd-kit, `@xyflow/react` + Yjs, Tiptap, cmdk, react-day-picker, react-hook-form + zod. No new UI libraries.

**Banned in the new code (grep-enforced in §9):** `backdrop-blur`, `glass`, `aura`, `bg-gradient-*` / `linear-gradient` / `radial-gradient` as surfaces, `text-transparent bg-clip-text`, spring/overshoot easings (`cubic-bezier(.34,1.56…)`), `transition-all`, `animate-[ping…]`, radii ≥ 16px on components (dialogs max 12), letter-spacing tighter than `-0.01em` on UI text, hex literals outside `globals.css`, white text on `#FF5C00`, the `.lg-vs-*` / `.lg-seg*` pill switchers, Onest font, violet anywhere.

**Accessibility floor:** WCAG AA; visible focus (2px orange, offset 2); all pickers keyboard-operable; tables are real `<table>` with `th scope`; live-region announcements on sort/filter; `prefers-reduced-motion` respected; 44px touch targets on mobile. Viewport zoom lock stays (explicit client demand) — isolate it in `app/layout.tsx` with a comment.

## 2. Design system (authoritative values in `DESIGN-TOKENS.md`)

- **Surfaces:** page canvas `#FAF9F7`, cards/rows `#FFFFFF`, 1px `#E6E3DE` borders, no card shadows; shadows only on floating layers (`e1` popovers, `e2` dialogs/side panel). Dark: `#000` / `#0A0A0A` / `rgba(255,255,255,.10)`.
- **Orange usage:** primary button (ink `#14110D` text), active nav rail / active tab underline, focus ring, selected-row rail, brand mark, links (orange-700 on light, orange-400 on dark). Nothing else is orange. Orange never fills large areas.
- **Type:** Inter only (400/500/600/700), JetBrains Mono for IDs/timestamps/kbd. Body and tables **13px/20**. Headings 16–24px/600. Eyebrow 11px uppercase `0.06em`. No display font.
- **Radius:** 4 inputs/chips · 6 buttons/menu items · 8 cards/popovers · 12 dialogs. **Spacing:** 4px grid.
- **Density:** comfortable 36px rows default; compact 28; spacious 44. Toggle in every list/table toolbar, persisted (`localStorage ui:density`).
- **Motion:** 100–220ms ease-out, opacity/transform only, none on hover except color; side panel slides 8px + fade.
- **Status/tag chips:** 12-hue pastel bg + deep text palette (tokens §4); status dot 8px.
- **Icons:** lucide 16px in UI, 14px in dense table cells, `strokeWidth 1.75`.

## 3. Information architecture (see `inspo/jira-new-navigation.png`, `UI-PATTERNS.md` §A)

### 3.1 Top bar (48px, sticky, white, 1px bottom border)
`[≡ sidebar toggle] [● mark] [APP_NAME]  ……  [🔍 Szukaj… (Cmd+K, 480px)] [+ Utwórz ▾ (orange)]  ……  [🔔 badge] [? skróty] [⚙] [avatar ▾]`
- `+ Utwórz` menu: Zadanie · Tablica · Przestrzeń · Kontakt · Deal · Notatka · Przypomnienie · Wpis czasu. Zadanie opens the create dialog pre-filled with the current board.
- Avatar menu: Ustawienia konta · Powiadomienia · 2FA · Sesje · Motyw (light/dark/system) · Gęstość · Panel admina (super-admin) · Wyloguj.
- `?` opens a keyboard-shortcuts sheet.

### 3.2 Left sidebar (240px, collapsible to 56px icon rail, persisted, mobile = drawer)
1. **Dla Ciebie** — Powiadomienia (badge), Zadania dla Ciebie, TO DO, Kalendarz, Notatnik, Przypomnienia, Urlopy
2. **Ostatnie ›** (last 5 boards/tasks from RouteTracker history) · **Oznaczone gwiazdką ›** (new: star on boards/tasks, `localStorage starred:v1`, structure ready for DB later)
3. **Przestrzenie** `[+]` — workspace rows (drag-reorder kept) → board rows; active row: `orange-50` bg + 2px `orange-500` left rail; workspace `…`: Ustawienia, Członkowie, Nowa tablica
4. **Narzędzia** (for the active workspace, else first workspace) — Kontakty, Plan sprzedaży, Czas pracy, Hasła, Subskrypcje, Creative Board, Support, Wiki, Whiteboardy, Kalendarz przestrzeni
5. **Więcej** — Wszystkie przestrzenie, Panel admina (super-admin), **Dostosuj pasek** (checkbox list to show/hide any item in sections 1 & 4; persisted)
6. Footer: user card (avatar, name, role) → same menu as top-bar avatar.

### 3.3 Board (project) header
```
Przestrzeń / Tablica                                   [Udostępnij] [⋯]
Nazwa tablicy ✎   ○○○○ +3                              
[⊞ Podsumowanie] [☰ Lista] [▤ Tablica] [≡ Oś czasu] [◇ Roadmapa] [▦ Kalendarz] [✎ Whiteboard] [⇢ Linia zadań] [¶ Opis] [+] [Więcej 2 ▾]
─────────────────────────────── (active tab: 2px orange underline)
[🔍 Szukaj w tablicy] [○○○ assignee filter] [Status ▾] [Priorytet ▾] [Tag ▾] [+ Filtr]      [Grupuj ▾] [Sortuj ▾] [Kolumny] [Gęstość ▾] [⋯]
```
Tabs overflow into `Więcej N ▾`. `+` opens create-view dialog (type + name). Custom views get `…` → rename/delete. Toolbar is shared across Lista/Tablica/Oś czasu/Kalendarz and persists to `BoardView.configJson`.

### 3.4 Task view — three modes (Jira)
- **Side panel** (default from any list; 600px, resizable 480–800, `e2` shadow, no backdrop dim; list stays interactive; `Esc`/`←→` J/K to move between tasks)
- **Modal** (from Cmd+K / notifications; 960px)
- **Full page** (`/w/[id]/t/[taskId]`; `⤢` button in panel header)
Layout (two columns from 900px, stacked below):
- Header row: `#250` mono · Status big dropdown (chip style with dot) · Priority · spacer · `Wyślij mailem` · `Przenieś` · `⤢` · `⋯` (Kopiuj link, Usuń) · `✕`
- Title: 20px/600 inline-editable (blur saves)
- LEFT: Opis (Tiptap; toolbar appears on focus; Zapisz/Anuluj only when dirty) → Podzadania (progress bar, inline add) → Załączniki (grid thumbs + file rows, drop zone) → Powiązane → Głosowanie → **Aktywność** with tabs `Wszystko · Komentarze · Historia · Czas pracy`, composer pinned at bottom
- RIGHT "Szczegóły" (labels 11px uppercase, values 13px, each row inline-editable): Przypisani · Priorytet · Start · Koniec · Milestone · Tagi · Przypomnienie · Cykliczność · Timer (start/pause/complete + tracked total) · Widoki (TaskView chips) · custom fields (all 16 types) · Utworzono/Zaktualizowano · toggle `Ukryj puste pola` · pin/unpin field order (localStorage)
- Autosave everywhere with 300ms debounce for text, immediate for pickers; optimistic UI; conflict (`version`) shows inline "Ktoś zmienił to zadanie — odśwież".

## 4. Views — build spec (details in `FUNCTIONAL-SPEC.md` §3)

**Lista/Tabela** (`inspo/airtable-grid*.png`): real `<table>`, sticky header (`neutral-50`, 11px uppercase labels + field-type icon), frozen checkbox + ID + Tytuł, row height by density, hover `neutral-100`, selected `orange-50` + rail. Every cell inline-editable (click → edit for text/number/date; pickers open popover; `Enter/Tab/Esc/arrows` grid navigation; `F2`). Header menu: sort ↑↓, filter, group, pin, hide, resize, rename/type (custom). Filter builder rows `[pole][operator][wartość]` + chips summary + `Wyczyść`. Group headers collapsible with count and numeric sums. Footer: `N zadań · M zaznaczonych` + sums. Bulk bar (bottom, `e2`): status, priorytet, przypisz, tag, usuń. `+ Dodaj zadanie` inline last row. Virtualize ≥300 rows (TanStack Virtual is allowed if needed — prefer CSS `content-visibility` first). Mobile: card list with the same fields.

**Tablica/Kanban** (`inspo/airtable-kanban.png`, `jira-2025-ui-5.png` right side): column header `DO ZROBIENIA · 6` (uppercase 11px) + `+` + `…`; flat cards (title 13px/500, ID mono, priority icon, chips, avatars right, due date); drag with 4px lift shadow only; collapse column; swimlanes by assignee/priority (toolbar Grupuj); WIP count.

**Oś czasu** (client screenshot 1:1): left frozen table (☐ › `SL-15` title + progress bar under title) 40% width resizable; right grid with month headers, week ticks, today vertical line, bars (status color, title inside if fits, drag move/resize both ends → dates), `+ Utwórz zadanie` inline row, bottom-right segmented `Dzisiaj | Tygodnie | Miesiące | Kwartały`; milestones as parent rows (expand children); TaskLink dependencies drawn as arrows.

**Roadmapa**: milestone bars on the same time grid as parents + tasks; alternative "markers" mode (dots + connectors) via toggle; milestone dialog; aggregator toggle for cross-board.

**Kalendarz**: month grid, pills (status color rail + title), drag to reschedule, `+N więcej`, day peek.

**Whiteboard / Linia zadań**: keep engines; rebuild toolbars (left vertical tool rail 40px, top-right actions, bottom-left zoom controls incl. fullscreen), minimap styling, node styles using token palette; taskline sidebar = same list styling as Lista.

**Podsumowanie** (new; `jira-2025-ui-3.png` right side): 4 KPI cards, status donut (pure SVG), priority bars, assignee workload bars, overdue list, recent activity feed.

**Opis**: Tiptap page, 720px measure.

## 5. Modules (build each per `FUNCTIONAL-SPEC.md` §5–§8; UI rules)
- Lists everywhere use the same DataTable primitives as Lista (Inbox, Zadania dla Ciebie, Kontakty, Support, Czas pracy, Subskrypcje, Admin tables).
- Three-pane tools (Notatnik, TO DO) = sidebar 240 / list 320 / detail flex; resizable dividers; mobile = stacked navigation.
- CRM contact card & deal page = task-panel layout (left content, right details).
- Sales pipeline = Kanban primitives.
- Timesheet = DataTable with 7 day columns + inline add; reports = KPI cards + tables with inline bars.
- Vault, Subscriptions = DataTable inline edit.
- Admin = same shell, admin sidebar section, DataTables + confirm dialogs.
- Auth pages: centered 400px card on canvas, mark + name, no aura; invite page shows scope.
- Share page: read-only Lista with banner.
- Czesiek AI: side panel 480px opened from Cmd+K "Zapytaj AI" or `?` menu; no floating FAB.
- Onboarding: 4-step dialog, restyled.

## 6. Components to build first (`components/ui/`)
Button (primary / secondary / ghost / danger / link; sizes sm 28 · md 32 · lg 36; icon variants; loading) · Input, Textarea (auto-grow), Select, Combobox (searchable, multi), DatePicker + DateTimePicker (react-day-picker, restyled), Checkbox, Switch, Radio, Slider(no) · DropdownMenu, ContextMenu, Popover, Tooltip (300ms delay), Dialog, Sheet (side/bottom), SidePanel (resizable) · Tabs (underline), SegmentedControl (for zoom/density) · Badge, Chip (removable), StatusPill, PriorityIcon, Avatar + AvatarStack, Kbd · Toast · Breadcrumb · EmptyState, ErrorState, Skeleton · DataTable kit (Table, Th with menu, Td editable wrappers, FilterBuilder, GroupHeader, BulkBar, DensityToggle, ColumnManager) · CommandPalette (cmdk restyled) · RichTextEditor chrome.
All primitives on `@base-ui/react` where one exists; CVA for variants; `cn()` util; no inline hex.

## 7. Files & conventions
- Absolute imports `@/*`. Server components by default; `"use client"` only where needed.
- Every route: `page.tsx` + `loading.tsx` skeleton matching final layout.
- Polish UI strings inline; plurals via `lib/pluralize.ts`; dates `Intl.DateTimeFormat("pl-PL")`; money `Intl.NumberFormat("pl-PL",{currency:"PLN"})`.
- Persisted UI prefs: `localStorage` keys prefixed `ui:` (`ui:theme`, `ui:density`, `ui:sidebar`, `ui:sidebar-items`, `ui:starred`, `ui:pinned-fields`).
- Keyboard map (global): `Cmd+K` palette · `C` create task · `/` focus search · `J/K` next/prev row · `Enter` open · `Esc` close · `X` select · `M` assign · `S` status · `P` priority · `?` help. Document in the `?` sheet.
- Delete legacy: `components/brand/flovly-logo.tsx`, `.lg-vs-*`, `.lg-seg*`, aura/glass CSS, Onest font, violet tokens, duplicate palettes in `icon.svg`/`opengraph-image.tsx`.

## 8. Phases (each ends with `npx tsc --noEmit`, `npm run lint`, screenshots of every changed route at 1440px and 390px, and a short changelog in `docs/redesign/CHANGELOG.md`)
1. **Foundation**: `globals.css` from tokens; `components/ui/*`; fonts; theme boot; top bar; sidebar (all sections, customize, rail, mobile drawer); board header + tabs + toolbar shell; `app/layout.tsx` metadata/icon/OG with new mark; delete legacy CSS/components.
2. **Lista + Task panel**: DataTable kit; Lista with full inline editing/filters/group/sort/bulk/import; task side panel/modal/full page with all sections; create-task dialog; `+ Utwórz` menu.
3. **Other board views**: Tablica, Oś czasu (client-screenshot fidelity), Roadmapa, Kalendarz, Podsumowanie, Opis; custom views + create/delete; backgrounds.
4. **Canvas chrome + personal modules**: Whiteboard/Linia zadań toolbars; Powiadomienia, Zadania dla Ciebie, TO DO, Kalendarz, Notatnik, Przypomnienia, Urlopy, Profil, Workspaces overview + workspace overview + settings + members.
5. **Workspace tools**: Kontakty, Plan sprzedaży, Creative Board, Support, Wiki, Whiteboardy list, Kalendarz przestrzeni, Hasła, Czas pracy + raporty, Subskrypcje.
6. **Admin, auth, share, AI, onboarding, command palette, notifications/toasts, shortcuts sheet.**
7. **Hardening**: mobile pass (375/390/768), a11y pass (axe, keyboard-only walkthrough), perf (Lighthouse ≥ 90 perf/a11y on Lista and Tablica; INP < 200ms), e2e smoke (`e2e/*.spec.ts` updated to new selectors), dark theme pass.

## 9. Definition of done (verify, don't assume)
- [ ] `grep -rn "backdrop-blur\|bg-aura\|glass\|text-brand-gradient\|bg-brand-gradient\|cubic-bezier(.34\|transition-all\|Onest\|#7A33EC\|#7C5CFF\|#E1318F" app components --include=*.tsx --include=*.css` → **0 results**
- [ ] `grep -rn "#[0-9A-Fa-f]\{6\}" components app --include=*.tsx | grep -v "globals.css"` → only in `lib/colors.ts`-driven data (status colors) — no UI literals
- [ ] Every checkbox in `FUNCTIONAL-SPEC.md` ticked with the file that implements it
- [ ] Every table cell in Lista editable inline; keyboard grid navigation works; filters persist per view
- [ ] Task side panel opens in < 100ms perceived (skeleton), closes back to the exact list scroll position
- [ ] All 43 permission actions respected (VIEWER cannot see edit affordances)
- [ ] Light + dark screenshots of all routes in `docs/redesign/screens/`
- [ ] No console errors on any route; `tsc` + `lint` clean; e2e smoke green
- [ ] Mobile: no horizontal overflow on any route at 375px

## 10. How to start
1. Read `FUNCTIONAL-SPEC.md`, `DESIGN-TOKENS.md`, `UI-PATTERNS.md`, `inspo/00-README.md`; open every image in `inspo/`.
2. `npm install`, `npm run dev` (port 3100), confirm login works with an existing account.
3. Create branch `redesign/orange`. Phase 1. Screenshot. Continue.
4. Do not ask for permission between phases; ask only when a functional ambiguity would change data behavior.
