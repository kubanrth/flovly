#!/bin/sh
# Start kontenera: migracje, potem serwer. Bez tego każdy push ze zmianą
# schematu wymagał ręcznego `migrate deploy` w terminalu Coolify
# (Subskrypcje 2026-08-27, Zapotrzebowanie 2026-09-07). Błąd migracji
# zatrzymuje start — lepiej głośno niż aplikacja z brakującą tabelą.
set -e
node /opt/prisma/node_modules/prisma/build/index.js migrate deploy --config prisma/deploy.config.mjs
exec node server.js
