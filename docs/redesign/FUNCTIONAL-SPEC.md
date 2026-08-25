# FUNCTIONAL-SPEC — everything the rebuilt UI must expose (1:1)

Source of truth for scope. Every `[ ]` must be checked off by the rebuild session. Backend (Prisma models, server actions, API routes, cron, permissions) is **kept as-is**; this list describes what the new UI must surface. Paths are the current implementations to read for behavior — not to keep.

Legend: **A** = admin-only (workspace ADMIN or super-admin), **P** = permission-gated (`lib/permissions.ts`).

---

## 0. Global shell
- [ ] Top bar: mark + `NEXT_PUBLIC_APP_NAME` · global search (Cmd+K) · `+ Utwórz` menu · notifications bell + unread badge (realtime) · help (`?` shortcuts) · settings · profile menu (Ustawienia konta, Powiadomienia, 2FA, Sesje, motyw, Panel admina if super-admin, Wyloguj `app/(app)/actions.ts:signOutAction`)
- [ ] Sidebar: sections Dla Ciebie / Ostatnie / Oznaczone / Przestrzenie (→ tablice, drag-reorder via `reorderWorkspacesAction`, `reorderBoardsAction`) / Narzędzia (per active workspace) / Więcej · Dostosuj pasek (show/hide items, persisted) · collapse to rail (persisted) · mobile drawer
- [ ] Theme light (default) / dark; persisted; SSR no-flash (`themeBootScript` pattern from `components/layout/theme-toggle.tsx`)
- [ ] Density toggle (compact / comfortable / spacious) persisted
- [ ] Command palette `components/search/command-palette.tsx`: workspaces, boards, recent tasks, actions (new task, invite, settings, inbox, AI), Cmd+1/Cmd+2, contextual row actions
- [ ] Onboarding tour (first login, 4 steps) → `completeOnboardingAction`
- [ ] Realtime: `hooks/use-workspace-realtime.ts` (channel `workspace:<id>`) + `use-user-realtime.ts`
- [ ] Toasts: notification toaster (realtime), reminder popups (`/api/reminders/due` poll 60s)
- [ ] Route tracker (`components/layout/route-tracker.tsx`) — keep for return-to + scroll restore
- [ ] Error surfaces: forbidden / offline / rate-limited / server-error; `error.tsx`, `not-found.tsx`, `loading.tsx` skeletons per route
- [ ] Zoom lock viewport meta (client demand) in one place

## 1. Auth
- [ ] `/secure-access-portal` login: email + password + optional 2FA/recovery code; rate-limit message (5/15min); autofill styling; remember-me; "Zapomniałem hasła" (admin-reset flow)
- [ ] `/invites/[token]`: accept invite (existing user = password check; new user = name + password), invalid/expired/used states, board vs workspace scope shown
- [ ] `/share/[token]` public read-only board snapshot (no auth): table of tasks, access counter

## 2. Workspaces
- [ ] `/workspaces`: grid + list toggle, drag-reorder, create dialog (name, slug, description, enabledViews), search
- [ ] `/w/[id]` overview: hero (name, members avatars, search tasks), boards grid/list drag-reorder, create board (name, description, views), quick actions
- [ ] `/w/[id]/settings` **A**: name/description, enabledViews, danger zone delete
- [ ] `/w/[id]/members` **P**: members list (role change, remove), pending invites (cancel), invite form (email, role, optional board scope), board tab: per-board membership + PUBLIC/PRIVATE visibility
- [ ] Workspace switcher popover (quick switch)

## 3. Boards & views
- [ ] Board header: breadcrumb, editable name, description, members stack, `…` (share link create/revoke `share-actions.ts`, background: none/color/gradient/image, delete **P**, columns manager, status columns manager)
- [ ] View tabs: default views (per `Workspace.enabledViews`) + named custom views (`BoardView.name`) + `+` create view dialog (type + name) + delete custom view + restore default
- [ ] Custom view scoping: named TABLE/KANBAN/GANTT show only `TaskView`-assigned tasks; named ROADMAP shows only `Milestone.boardViewId` milestones; named WHITEBOARD has own canvas (`kind=view:<id>`); default views show all
- [ ] Per-view persisted config (`BoardView.configJson`): columnOrder, hidden, widths, pinned, filters[], sort, groupBy — via `saveTableFiltersAction` & column prefs actions in `b/[boardId]/actions.ts`

### 3.1 Lista / Tabela (`components/table/board-table.tsx`)
- [ ] Built-in columns: checkbox, ID (`displayId`, mono), Tytuł (primary, frozen), Status, Priorytet, Przypisani, Tagi, Start, Koniec, Załączniki, Milestone, activity hints (opis / podzadania done/total / komentarze / powiązane / załączniki)
- [ ] Custom columns: 16 FieldTypes (`lib/table-fields.ts`): TEXT, LONG_TEXT, NUMBER (integer/decimal/currency/percent + precision), DATE (±time), CHECKBOX, SINGLE_SELECT, MULTI_SELECT (options + colors), URL, EMAIL, PHONE, RATING (max + icon), USER, ATTACHMENT, CREATED_TIME, LAST_MODIFIED_TIME, AUTO_NUMBER — add/rename/retype/reorder/delete column; header shows type icon
- [ ] Inline edit every cell (click/Enter/F2; Esc cancel; Tab/arrows nav); optimistic; `patchTaskAction` + custom value action
- [ ] Column header menu: sort asc/desc, filter by this field, group by, pin, hide, resize (drag), rename/type (custom)
- [ ] Filters: builder with 19 operators (`lib/table-filters.ts`), AND; chips bar + "Wyczyść"; mobile drawer
- [ ] Sort (multi), Group by (status/title/start/stop/custom + presets `lib/group-presets.ts`: createdAt/startAt/stopAt buckets, tagsAlpha) with collapsible headers + counts (+ sums for NUMBER)
- [ ] Row selection (shift-range) + bulk bar: status, priority, assign/unassign, delete (`bulk*Action`s)
- [ ] Client search (Cmd+F) over title + custom cells
- [ ] Add row inline at bottom (quick create) + `+ Nowe zadanie` dialog (title, status, priority, view assignment)
- [ ] Import CSV/XLSX (`import-tasks-dialog.tsx`, ≤500 rows, column mapping) — gated by `import_csv_xls` flag
- [ ] Sticky header, frozen primary column, virtualization ≥ 300 rows, density modes, keyboard nav, live-region announcements
- [ ] Totals row (count; sum for number columns) at footer

### 3.2 Tablica / Kanban (`components/kanban/kanban-board.tsx`)
- [ ] Columns = StatusColumn (add, rename, color, reorder, delete, collapse); "Bez statusu" bucket
- [ ] Cards: title, ID, priority icon, assignees, tags, due date, activity hints; drag within/between columns (dnd-kit) → `moveTaskAction`/rowOrder
- [ ] Quick add at column bottom (stay in edit mode for multiple)
- [ ] Toolbar: search, assignee filter, filter chips, group/swimlanes (assignee, priority) — new, WIP counts in headers
- [ ] Column overflow/scroll, mobile horizontal scroll with snap

### 3.3 Oś czasu / Gantt (`components/roadmap/gantt-view.tsx` + client Jira screenshot)
- [ ] Left frozen table (checkbox, expand, ID, title, progress bar) + right time grid; zoom Dzisiaj/Tygodnie/Miesiące/Kwartały; today line; bars from startAt/stopAt; drag/resize bar → dates; unscheduled tasks list; milestone parent rows with child tasks; dependencies = TaskLink arrows (read-only)

### 3.4 Roadmapa (`components/roadmap/roadmap-view.tsx`)
- [ ] Milestones: create/edit/delete dialog (title, description, dates, assignee) **P**; markers mode (dots + connectors, K111) and bars mode; expand tasks per milestone; assign/unassign task ↔ milestone; cross-board aggregation (`Board.isAggregator`, `MilestoneLink`) with linker picker; mobile vertical timeline

### 3.5 Kalendarz (board) (`components/calendar/calendar-board.tsx`)
- [ ] Month grid Mon-first, task pills by start/stop, drag to reschedule, +N more, month/year nav, click → task panel, mobile day expand

### 3.6 Whiteboard (`components/canvas/canvas-editor.tsx` — keep engine, restyle chrome)
- [ ] Shapes (rectangle/diamond/circle/icon/sticky/frame/text/image), edges (styles, end markers), pen strokes, minimap, zoom controls incl. fullscreen (K130), lock, duplicate, image upload, PNG export, node↔task link, create task from node, 12 templates, text color/font size pickers, connection status badge, Yjs realtime + awareness; mobile toolbar

### 3.7 Linia zadań (`components/canvas/taskline-*.tsx`)
- [ ] Sidebar of unplaced tasks (search, assignee filter, drag) + canvas of task nodes in named horizontal lines; start/end flow marks; append/reorder/remove; create/rename/delete lines; click card → task panel (K112)

### 3.8 Podsumowanie (new, Jira Summary)
- [ ] KPI row (done / updated / created / due in 7d), status donut, priority bars, assignee workload, overdue list, recent activity (AuditLog)

### 3.9 Opis (`components/view/board-overview-editor.tsx`)
- [ ] Per-board Tiptap rich text (`Board.overviewJson`), autosave

## 4. Task (panel / modal / full page) (`components/task/task-detail.tsx`, `task-modal-shell.tsx`, `@modal/(.)t/[taskId]`)
- [ ] Header: ID, status (big dropdown), priority, `Wyślij mailem` (`email-actions.ts`), `Przenieś` to board (`move-task-menu.tsx`), open full page, copy link, delete
- [ ] Title inline edit (autosave on blur)
- [ ] Description Tiptap (`rich-text-editor.tsx`: headings, bold/italic/strike, lists, quote, code, link, table, image, mention, highlight, color) with Save/Cancel + autosave
- [ ] Details column: status, priority, assignees (multi + `M` hotkey), start/end datetime pickers (autosave), milestone select, tags (create/toggle, colors), reminder offset presets, recurrence (daily/weekly/monthly + day), timer (start/pause/complete → TimeEntry), custom fields (16 types), task views membership, contact link (hidden by default), "hide empty fields", pin fields
- [ ] Sections: Podzadania (add/toggle/delete, progress), Załączniki (upload signed URL, image thumbs, video, SVG download-only, 25/50MB, delete), Powiązane (link/unlink, bidirectional), Głosowanie (create 2–5 options, vote, close, delete), Pola dodatkowe
- [ ] Activity tabs: Wszystko / Komentarze (Tiptap, threaded, edit/delete, @mentions → notification) / Historia (AuditLog timeline) / Czas pracy (TimeEntries for task)
- [ ] Optimistic-lock `version` conflict message
- [ ] Return-to: closing panel returns to originating list + scroll (K135/K138)

## 5. Personal modules ("Dla Ciebie")
- [ ] **Powiadomienia** `/inbox`: unread/read groups, mark read/all, toggle, delete, delete all read, per-notification note, hotkeys (j/k/enter/e), types: task.assigned/created/changed/status.changed, comment.mention, poll.created, support.created/assigned/resolved; link to task panel
- [ ] **Zadania dla Ciebie** `/my-tasks`: cross-workspace assigned tasks, board multi-filter, sort modes, inline status, done detection, hotkeys; super-admin `?user=` employee view
- [ ] **TO DO** `/my/todo`: folders tree → lists → items → steps; important, My Day, due date, reminder (email), notes, rename, bulk delete completed; smart lists my-day/important/planned/assigned; detail panel
- [ ] **Kalendarz** `/my/calendar`: month grid of my tasks, workspace filter
- [ ] **Notatnik** `/my/notes`: 3-column (folders + smart all/pinned/recent/trash · list · editor), create/rename/delete folder, note CRUD, move, pin, Tiptap, trash restore/purge, search
- [ ] **Przypomnienia** `/my/reminders`: create for self/colleague (title, body, dueAt), sent/received tabs, edit, dismiss, hide, delete, bulk delete old; popup bubbles
- [ ] **Urlopy** `/vacations`: request (dates, reason), my list + cancel, 90-day team calendar; super-admin approve/reject with note
- [ ] **Profil** `/profile`: dashboard tiles, status breakdown, activity feed, team table; account form (name, avatar, timezone, hourly rate), password change, 2FA enroll/disable + recovery codes, sessions

## 6. Workspace tools ("Narzędzia")
- [ ] **Kontakty** `/w/[id]/contacts` **P**: table + mobile list, search (company/name/email/NIP), create/edit (person, company, NIP/REGON/VAT, address, owner, notes), soft delete/restore; card: timeline (ContactActivity), deals pipeline, linked tasks, email conversation (Resend send + inbound)
- [ ] **Plan sprzedaży** `/w/[id]/sales` **P**: stages (CRUD, color, order, closedKind won/lost), deals kanban drag (stage + rowOrder), deal form (value+currency, expected close, owner, contact), deal page timeline + reminder with note; mobile pipeline
- [ ] **Creative Board** `/w/[id]/briefs`: list, create from 11 templates (`lib/brief-templates.ts`), editor (Tiptap tables/images, emoji, header color), status DRAFT/IN_REVIEW/APPROVED/ARCHIVED
- [ ] **Support** `/w/[id]/support`: tickets CRUD, status/priority, dueAt or NATYCHMIAST, assignee, attachments, notifications
- [ ] **Wiki** `/w/[id]/wiki` **P**: single Tiptap page, save bar
- [ ] **Whiteboards** `/w/[id]/canvases` + `/c/[canvasId]`: list, create, rename, delete, editor (same engine)
- [ ] **Kalendarz** (workspace) `/w/[id]/calendar`: all tasks + WorkspaceEvent CRUD (title, desc, start/end, allDay, color)
- [ ] **Hasła** `/w/[id]/passwords`: vault list grouped by category, search, create (name/category/url/username/password/notes), explicit reveal (`revealSecretAction`), copy, delete — never plaintext in SSR
- [ ] **Czas pracy** `/w/[id]/time` + `/time/reports`: weekly grid (Mon–Sun × task rows, day/row/grand totals), manual entry dialog (start/stop/note/billable), entry chips (approved ✓, non-billable ⊘, delete own), user filter, week nav; reports: date range, billable-only, KPI (total/billable/value), per user/task/board tables + progress bars, CSV export; approvals (**A**) via `approveTimeEntryAction`
- [ ] **Subskrypcje** `/w/[id]/subscriptions`: inline table (name, project, amount PLN, cycle, monthly/yearly computed), KPI totals, project filter (totals per project), add row, delete; **A**: "Projekty i dostępy" dialog (create project, toggle member chips, delete project); visibility: admin all / member = unassigned + own projects

## 7. Admin panel `/admin` (super-admin)
- [ ] Dashboard stats (users, workspaces, tasks, actions 24h)
- [ ] Users: paginated table, ban/unban, super-admin toggle, soft delete, create user, reset password (wipes 2FA + sessions), bulk ban/superadmin
- [ ] Workspaces: table (owner, members, boards, tasks, storage, backup, status), restore, force delete, restore-from-backup
- [ ] Audit (workspace AuditLog: filters action/actor/days, expandable diff) · Admin actions log
- [ ] Backups: list with modelCounts, trigger one/all, signed download
- [ ] System flags: `ai_ateron_enabled`, `public_share_links`, `whiteboard_beta`, `import_csv_xls`, `kill_switch_writes` (+ last changed by)
- [ ] Admin nav (desktop sidebar + mobile)

## 8. Czesiek / Ateron AI (`components/czesiek/*`)
- [ ] Entry point: Cmd+K action + `…`/help menu (not a floating orange FAB); panel 720px desktop / fullscreen mobile; sessions drawer (list/create/delete); thread with tool-call rendering; gated by `ai_ateron_enabled`; rate limits shown

## 9. Cross-cutting rules
- [ ] Permissions (43 actions, roles ADMIN/MEMBER/VIEWER) respected in UI: hide/disable per `can(role, action)`; VIEWER read-only surfaces
- [ ] Rate-limit errors rendered inline (not generic crash)
- [ ] Audit: every mutation already logs; UI shows history where relevant
- [ ] Polish copy everywhere; `lib/pluralize.ts` for plurals; dates `pl-PL`; currency `Intl` PLN
- [ ] Mobile: every module usable at 375px (drawers/bottom sheets for pickers, 44px targets)
- [ ] a11y: focus-visible everywhere, aria on tables/menus/dialogs, reduced motion
- [ ] Performance: no backdrop-blur, no continuous animations, virtualized long lists, `loading.tsx` per route, INP < 200ms
