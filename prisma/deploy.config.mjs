// Konfiguracja Prismy dla obrazu produkcyjnego (standalone). Zwykły
// `prisma.config.ts` importuje dotenv i tsx, których w obrazie nie ma —
// tu tylko to, czego potrzebuje `migrate deploy` przy starcie kontenera.
// Ścieżki są względem tego pliku, nie cwd.
export default {
  schema: "schema.prisma",
  migrations: { path: "migrations" },
  // Jak w prisma.config.ts: migracje nie przechodzą przez pooler.
  datasource: { url: process.env.DIRECT_URL ?? process.env.DATABASE_URL },
};
