# E2E Tests (Playwright)

Pełna E2E test suite — 41 testów w 12 specach, chromium desktop + iPhone 12 mobile viewport.

## Co testuje

| Spec | Scope |
|---|---|
| `01-auth` | Login (poprawne + błędne hasło), logout via ProfileDropdown |
| `02-workspaces` | Lista workspace'ów, klik card → /w/[id], create workspace |
| `03-board-create` | "+ Tablica" dialog, default 4 status columns + 7 views |
| `04-task-creation` | Create Task dialog, modal close < 3s (regression F12-K99 hang) |
| `05-task-drawer-pickers` ⭐ | **Date / Status / Priority / Assignee / Tag / Milestone / Recurrence / Reminder** — wszystkie portalled popovery widoczne nad task drawer backdrop (regression F12-K101 z-stacking) |
| `06-table-view` | Column resize persist (F12-K90), sort, filter, bulk select, ID column NIE istnieje (F12-K87) |
| `07-kanban` | DnD task między kolumnami, inline add |
| `08-view-switcher` ⭐ | Switch między 8 widokami, smooth ViewTransition (F12-K88), single-row pasek |
| `09-whiteboard` | Pen color change (F12-K91), draw 5 strokes bez freeze, zoom |
| `10-my-tasks` | Sekcje Zaległe/Na dziś/Nadchodzące, done tasks NIE w Zaległe (F12-K91) |
| `11-admin-panel` | 4 stat cards equal height (F12-K100), /admin/flags 5 toggles, /admin/users checkbox |
| `12-mobile-bottom-sheets` 📱 | Date picker → bottom sheet (NIE popover), Ateron AI fullscreen + sessions drawer solid bg (F12-K94), mobile sidebar solid bg |

## Jak odpalić

### Wymagania
- Lokalny Postgres (np. via Docker, Homebrew, Postgres.app)
- Lokalna baza zsetupowana (migracje + seed)

### Setup (jednorazowy)
```bash
# 1. Postgres uruchomiony lokalnie (np. via Docker):
docker run -d --name flovly-test-pg \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=test \
  -e POSTGRES_DB=flovly_test \
  -p 5433:5432 \
  postgres:15-alpine

# 2. Tymczasowy override env (NIE commit!):
cat > .env.test <<EOF
DATABASE_URL="postgresql://postgres:test@localhost:5433/flovly_test"
DIRECT_URL="postgresql://postgres:test@localhost:5433/flovly_test"
AUTH_SECRET="test-secret-min-32-chars-long-1234567890"
EOF

# 3. Apply migrations + seed do test DB:
DATABASE_URL=$(grep DATABASE_URL .env.test | cut -d= -f2- | tr -d '"') \
DIRECT_URL=$(grep DIRECT_URL .env.test | cut -d= -f2- | tr -d '"') \
npm run db:deploy

DATABASE_URL=$(grep DATABASE_URL .env.test | cut -d= -f2- | tr -d '"') \
DIRECT_URL=$(grep DIRECT_URL .env.test | cut -d= -f2- | tr -d '"') \
npm run db:seed
```

### Run
```bash
# Terminal A: dev server (background)
npm run dev

# Terminal B: testy
npx playwright test

# Lub UI mode (interactive):
npx playwright test --ui

# Lub konkretny spec:
npx playwright test 05-task-drawer-pickers

# Lub konkretny test:
npx playwright test -g "Status picker"
```

### Report
```bash
npx playwright show-report
```

Failed testy mają screenshot + video w `test-results/`.

### Cleanup
```bash
docker stop flovly-test-pg && docker rm flovly-test-pg
rm .env.test
```

## Console errors

Każdy test używa fixture `e2e/fixtures/console-errors.ts` — łapie `pageerror` + `console.error` i fail'uje test jeśli wystąpią. Whitelist dla HMR/Sentry noise.

## CI integration

Dodaj do `.github/workflows/e2e.yml` (przykład):

```yaml
- name: E2E tests
  run: npx playwright test
  env:
    DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
    DIRECT_URL: ${{ secrets.TEST_DIRECT_URL }}
    AUTH_SECRET: test-secret-min-32-chars-long-1234567890

- name: Upload report
  if: always()
  uses: actions/upload-artifact@v4
  with:
    name: playwright-report
    path: playwright-report/
```

## Best practices

- **Sequential workers (1)**: testy współdzielą DB state, parallel = race conditions
- **Storage state**: `auth.setup.ts` loguje raz, zapisuje session do `.auth/admin.json`. Reszta testów reuse'uje
- **Cleanup**: każdy test usuwa stworzone dane w `afterAll`
- **Mobile viewport**: project `mobile-chromium` używa iPhone 12 (390×844)
- **Selectors**: best-effort bez `data-testid` (codebase nie ma) — fine-tune po pierwszym runie

## Znane limitacje

- **Realtime** (Supabase broadcast): trudno testować w E2E bez 2 sessions parallel
- **2FA**: pominięte (demo user nie ma włączonego)
- **Email**: notifyBoardEvent nie testowane (wymaga Resend mock)
