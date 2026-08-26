# ROLLBACK — powrót do UI v4 (stan sprzed redesignu)

Punkt powrotu: tag **`v4-pre-redesign`** = branch **`legacy/v4-ui`** = commit `5733b4e` (2026-08-26).
Kopia offline: `~/Desktop/flovly-backup-2026-08-26/` (źródła zip, pełna historia `.bundle`, `schema-v4.prisma`).

## 0. Przed wdrożeniem redesignu — zrób TERAZ (Coolify)

### a) Zrzut bazy (Coolify → Postgres → Terminal)
```sh
pg_dump -U postgres -Fc flovly > /tmp/flovly-pre-redesign-2026-08-26.dump
ls -lh /tmp/flovly-pre-redesign-2026-08-26.dump
```
Pobierz plik na dysk (Coolify → Postgres → **Backups → Backup now** też działa; ustaw retencję ≥ 7 dni). Dodatkowo w aplikacji: `/admin/backups → Wymuś backup wszystkich` (JSON per workspace do bucketu `attachments`).

### b) Env vars
Coolify → aplikacja → Environment Variables → skopiuj całość do menedżera haseł (zwłaszcza `AUTH_SECRET`, `VAULT_KEY`, `SUPABASE_SECRET_KEY`, `RESEND_API_KEY`, `CRON_SECRET`, `DATABASE_URL`). Redesign ich nie zmienia, ale bez `VAULT_KEY` sejf haseł jest stracony.

### c) Obraz Docker
Coolify → aplikacja → **Deployments** — zapamiętaj ID ostatniego udanego deploya (to jest v4). Coolify trzyma poprzednie obrazy; rollback = jeden klik.

### d) Storage (Supabase `attachments`)
Redesign nie dotyka plików. Nic do robienia. (Opcjonalnie: Supabase → Storage → bucket → snapshot przez `supabase storage` CLI.)

## 1. Rollback szybki (UI nie działa, dane OK) — ~2 min
Coolify → aplikacja → Deployments → poprzedni udany deploy → **Redeploy**.
Albo z gita:
```sh
git checkout main
git reset --hard v4-pre-redesign     # lokalnie
git push --force-with-lease origin main
```
Coolify zbuduje v4 automatycznie z pusha. Baza zostaje — redesign nie zmienia schematu, więc dane są kompatybilne.

## 2. Rollback z zachowaniem historii (preferowany, gdy redesign już scommitowany)
```sh
git checkout main
git revert --no-commit v4-pre-redesign..HEAD
git commit -m "revert: rollback UI do v4 (tag v4-pre-redesign)"
git push origin main
```

## 3. Rollback bazy (tylko jeśli redesign dodał migracje i coś poszło źle)
```sh
# Coolify → Postgres → Terminal
psql -U postgres -c "DROP DATABASE flovly;" postgres
psql -U postgres -c "CREATE DATABASE flovly;" postgres
pg_restore -U postgres -d flovly /tmp/flovly-pre-redesign-2026-08-26.dump
```
Potem redeploy aplikacji w wersji v4 (pkt 1). **Uwaga:** tracisz wszystko wpisane po zrzucie — rób to tylko przy uszkodzeniu danych, nie przy błędach UI.

## 4. Odtworzenie repo z kopii offline (gdy GitHub niedostępny)
```sh
git clone ~/Desktop/flovly-backup-2026-08-26/flovly-v4-full-history-2026-08-26.bundle flovly
cd flovly && git checkout v4-pre-redesign
```

## 5. Zasady wdrożenia redesignu, żeby rollback był bezbolesny
- Redesign na branchu `redesign/orange`; merge do `main` dopiero po smoke-teście na Coolify **preview** (drugi app w Coolify z tego brancha) albo lokalnie na prod-DB read-only.
- Zero zmian w `prisma/schema.prisma` w trakcie redesignu (tak zakłada `PROMPT.md`). Jeśli jednak migracja jest konieczna — najpierw zrzut bazy (pkt 0a), migracja addytywna (bez DROP), dopiero potem deploy.
- Po deployu: sprawdź login, otwarcie zadania, zapis daty w tabeli, upload załącznika, sejf haseł (reveal), timer. Jeśli cokolwiek pada → pkt 1.
