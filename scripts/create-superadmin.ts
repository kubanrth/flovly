// Tworzy konto super admina bez chodzenia przez UI/invite flow.
// Produkcja (Coolify Terminal flovly): npx tsx scripts/create-superadmin.ts
// Opcjonalnie: EMAIL=... PASSWORD=... NAME=... npx tsx scripts/create-superadmin.ts
// Lokalnie: `set -a && source .env && set +a` przed komendą.
import bcrypt from "bcrypt";
import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const BCRYPT_COST = 12;

const email = (process.env.EMAIL ?? "kamil@herodot.com").trim().toLowerCase();
const password = process.env.PASSWORD ?? "kamil123";
const name = process.env.NAME ?? "Kamil";

if (!email.includes("@") || email.length < 5) {
  console.error("Niepoprawny EMAIL.");
  process.exit(1);
}
if (password.length < 8) {
  console.error("Hasło musi mieć min 8 znaków.");
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

async function main() {
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  const existing = await db.user.findUnique({ where: { email } });

  if (existing && !existing.deletedAt) {
    console.error(`User ${email} już istnieje (id=${existing.id}). Skasuj/odbanuj w panelu albo użyj innego maila.`);
    process.exit(2);
  }

  if (existing?.deletedAt) {
    const restored = await db.user.update({
      where: { id: existing.id },
      data: {
        name,
        passwordHash,
        isSuperAdmin: true,
        isBanned: false,
        deletedAt: null,
        totpSecret: null,
        totpEnabledAt: null,
      },
    });
    console.log(`✅ Przywrócono soft-deleted user'a: ${email} (id=${restored.id}) jako super admin.`);
    return;
  }

  const created = await db.user.create({
    data: { email, name, passwordHash, isSuperAdmin: true },
  });
  console.log(`✅ Utworzono super admina: ${email} (id=${created.id})`);
  console.log(`   Hasło: ${password}`);
  console.log(`   Zaloguj: https://<twoja-domena>/secure-access-portal`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
