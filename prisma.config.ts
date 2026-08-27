import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Direct connection (port 5432) for Prisma CLI — migracje nie przechodzą
    // przez pooler. Zapytania w runtime idą poolerem (6543) przez adapter
    // w lib/db.ts.
    //
    // Fallback na DATABASE_URL jest istotny: środowiska bez poolera (Coolify)
    // nie ustawiają DIRECT_URL i `prisma migrate deploy` wywalał się tam na
    // „The datasource.url property is required", zamiast po prostu zadziałać.
    url: process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"],
  },
});
