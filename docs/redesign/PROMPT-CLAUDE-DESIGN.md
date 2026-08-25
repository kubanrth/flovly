# DESIGN BRIEF — for Claude Design (visual mockups before implementation)

> Paste into Claude Design. **Attach** every image from `inspo/` and `brand/palette-card.svg` + `brand/mark.svg`. Output is consumed later by Claude Code via `PROMPT.md`, so file naming below matters.

---

## What we're designing
A complete visual redesign of a Polish-language project-management web app (ClickUp/Jira-class: workspaces → boards → tasks with 9 views, plus CRM, sales pipeline, time tracking, password vault, subscriptions, notes, todo, calendar, inbox, admin). The current UI (violet glassmorphism, big radii, gradients) is being thrown away. Backend stays; only the UI is new.

**Direction in one line:** *Jira's 2025 navigation × Airtable's dense editable grid × Linear's restraint — painted in Marty Supreme orange on white.*

## Brand
- **Primary:** `#FF5C00` (Marty Supreme / A24 ping-pong orange). Use ONLY for: primary button, active nav rail / active tab underline, focus ring, selected-row rail, links, logo. Never as a page or card background. **Text on orange is near-black `#14110D`, never white.**
- **Neutrals (warm):** page canvas `#FAF9F7`, cards/rows `#FFFFFF`, borders `#E6E3DE`, secondary text `#66625B`, primary text `#1C1A17`. Dark theme: `#000000` bg, `#0A0A0A` cards, `rgba(255,255,255,.10)` borders.
- **Semantic:** success `#1E9E5A`, warning `#E8A100`, danger `#D6382C`, info `#2F6FE8`. Status/tag chips: pastel background + deep text (Airtable-like), 12 hues.
- **Type:** Inter (400/500/600/700) — body & tables **13px**, headings 16–24px/600, eyebrows 11px uppercase. Mono (JetBrains Mono) only for IDs like `#250`, timestamps, keyboard hints. No display/serif font.
- **Shape:** radius 4 (inputs/chips), 6 (buttons), 8 (cards/popovers), 12 (dialogs). 1px borders. Flat cards (no shadow); shadows only on popovers/dialogs/side panels.
- **Logo:** orange sphere with a flat cut (see `mark.svg` variant A). Product name is a placeholder — use **"NAZWA"** as the wordmark everywhere.
- **Density:** compact and calm. Table rows 36px. Sidebar rows 32px. Top bar 48px. Nothing decorative.

## Hard "no" list (the old UI did all of this — do not repeat)
Glass / blur panels · aura or mesh gradients · gradient text · pill-shaped "liquid" tab switchers · 20px+ radii · spring/bouncy motion · violet anywhere · white text on orange · hero cards with two-line headers in lists · uppercase mono labels with wide tracking used as headings.

## Navigation model to draw (see `jira-new-navigation.png`)
- **Top bar 48px:** ☰ · logo+NAZWA · wide global search "Szukaj… ⌘K" · `+ Utwórz` (orange) · 🔔 (badge) · ? · ⚙ · avatar.
- **Left sidebar 240px** (collapsible to 56px rail): **Dla Ciebie** (Powiadomienia, Zadania dla Ciebie, TO DO, Kalendarz, Notatnik, Przypomnienia, Urlopy) · **Ostatnie ›** · **Oznaczone gwiazdką ›** · **Przestrzenie +** (workspace → boards; active = orange-50 bg + 2px orange left rail) · **Narzędzia** (Kontakty, Plan sprzedaży, Czas pracy, Hasła, Subskrypcje, Creative Board, Support, Wiki) · **Więcej / Dostosuj pasek** · footer user card.
- **Board header:** breadcrumb `Przestrzeń / Tablica` · name + member avatars + `…` · **horizontal tabs with icons, underline active:** Podsumowanie · Lista · Tablica · Oś czasu · Roadmapa · Kalendarz · Whiteboard · Linia zadań · Opis · `+` · `Więcej 2 ▾` · toolbar row: search · assignee avatars · filter chips · right: Grupuj · Sortuj · Kolumny · Gęstość.
- **Task opens as a side panel** (600px, list stays visible) — also modal and full-page variants.

## Screens to design (priority order; desktop 1440 + mobile 390 for ★ items)

### P0 — foundation
1. ★ **Design system sheet** — colors, type scale, buttons (primary/secondary/ghost/danger, sizes), inputs, select/combobox, checkbox/switch, chips/status pills/priority icons, avatars, tabs, dropdown, popover, dialog, side panel, toast, empty state, table cell states (default/hover/selected/editing/focus), density variants (28/36/44).
2. ★ **App shell** — top bar + sidebar (expanded, rail, mobile drawer) + board header with tabs + toolbar. Light and dark.
3. ★ **Lista (table)** — like `airtable-grid.png`: sticky header with field-type icons, frozen ☐ / ID / Tytuł, columns: Status, Priorytet, Przypisani, Tagi, Start, Koniec, Załączniki, 2–3 custom fields (number, select, checkbox), grouped variant with collapsible group headers + counts, a cell in edit mode, bulk-action bar at bottom, filter builder popover, column header menu, "+ Dodaj zadanie" inline row, footer "128 zadań · 12 zaznaczonych".
4. ★ **Task side panel** — header (`#250`, big Status dropdown, priority, actions), title, description editor with toolbar, Podzadania with progress, Załączniki grid, Powiązane, Głosowanie, Aktywność tabs (Wszystko / Komentarze / Historia / Czas pracy) with composer; right "Szczegóły" column (Przypisani, Priorytet, Start, Koniec, Milestone, Tagi, Przypomnienie, Cykliczność, Timer, custom fields, "Ukryj puste pola"). Also: modal and full-page variants (desktop only).

### P1 — board views
5. ★ **Tablica (Kanban)** — column headers `DO ZROBIENIA · 6`, flat cards, `+ Utwórz zadanie`, one card dragging, swimlane variant (grouped by assignee).
6. ★ **Oś czasu (Gantt)** — replicate the client's Jira screenshot (`jira-timeline-client.png`) 1:1 in our brand: left frozen table with expand arrows + progress bars, month grid, today line, bars, inline create row, zoom control `Dzisiaj | Tygodnie | Miesiące | Kwartały` bottom-right.
7. **Roadmapa** — milestone bars with expandable task rows + "markers" mode (dots connected by arrows).
8. **Kalendarz** — month grid with task pills, `+2 więcej`, day peek popover.
9. **Podsumowanie** — KPI cards (ukończone / zaktualizowane / utworzone / termin w 7 dni), status donut, priority bars, obciążenie zespołu, ostatnia aktywność (like `jira-2025-ui-3.png` right side).
10. **Whiteboard** — canvas chrome only: left vertical tool rail, top-right actions, bottom-left zoom/fullscreen, minimap, one sticky + one shape + one connector styled in brand.
11. **Linia zadań** — left task list + canvas of task cards in horizontal lanes with start/end markers.
12. **Opis** — rich-text page.

### P2 — personal & tools
13. ★ **Powiadomienia (Inbox)** — grouped nieprzeczytane/przeczytane, row actions, note field.
14. **Zadania dla Ciebie** — cross-workspace list with board filter chips.
15. **TO DO** — 3-pane (foldery/listy · items · detail with steps, My Day, important).
16. **Notatnik** — 3-pane Apple-Notes style.
17. **Przypomnienia**, **Urlopy** (request form + 90-day team calendar), **Kalendarz osobisty** — one screen each.
18. **Kontakty** — table + contact card (details left, timeline/deals/tasks/email tabs right).
19. **Plan sprzedaży** — pipeline kanban + deal page.
20. **Czas pracy** — weekly timesheet grid (Mon–Sun × tasks, totals) + Raporty (KPI + per user/task/board bars).
21. **Hasła** — vault list grouped by category, reveal state, create dialog.
22. **Subskrypcje** — inline table with Projekt column, KPI totals, "Projekty i dostępy" dialog with user chips.
23. **Creative Board** (brief list + editor), **Support** (tickets), **Wiki** — one screen each.
24. **Przestrzenie** (all workspaces grid/list) + **Przegląd przestrzeni** (boards grid) + **Członkowie** + **Ustawienia**.

### P3 — system
25. **Logowanie** (`/secure-access-portal`, 2FA field), **Zaproszenie**, **Udostępniona tablica** (public read-only).
26. **Panel admina** — users table, workspaces table, audit, backups, flags.
27. **Cmd+K palette**, **`?` shortcuts sheet**, **Onboarding** 4-step dialog, **AI panel** (Czesiek) as a right side panel.
28. **Dark theme** versions of 2, 3, 4, 5.

## Deliverable format (must match what our implementation step expects)
- One folder `v5/` with **static HTML+CSS mockups**, one file per screen, named `NN-screen-name.html` (e.g. `03-lista.html`, `03-lista-mobile.html`), plus `00-design-system.html` and `tokens.css` containing all colors/type/spacing as CSS variables (names free, values exact).
- Real Polish copy (no lorem), realistic data: workspace "Projekty AI", boards "P&R Kickback", "P&R SLOT64", tasks like "Zmienić słowo Klub na Club w przycisku Kickback Club", users Daniel / Kuba / Gabryś, statuses "Do zrobienia / W toku / Do poprawy / Gotowe", priorities P0–P3.
- Every interactive element shown in at least one non-default state somewhere (hover, focus, editing, selected, disabled, empty, error, loading skeleton).
- Desktop 1440×900; mobile 390×844 for ★ screens.
- A `README.md` in `v5/` listing screens and any decisions you made that deviate from this brief, with one-line reasons.

## Quality bar
If a screen could be mistaken for Jira or Airtable at a glance *except for the orange*, it's right. If it looks like a landing page, a dashboard template, or the old violet app — start over.
