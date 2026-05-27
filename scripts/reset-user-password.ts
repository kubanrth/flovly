// Resetuje hasło dowolnego usera z linii poleceń (omija UI admin).
// Uruchom: EMAIL=jl@kickback.pl PASSWORD=nowehaslo npx tsx scripts/reset-user-password.ts
import "dotenv/config";
import bcrypt from "bcrypt";
import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const BCRYPT_COST = 12;

const email = (process.env.EMAIL ?? "").trim().toLowerCase();
const password = process.env.PASSWORD ?? "";

if (!email || !email.includes("@") || email.length < 5) {
  console.error("Brakuje albo niepoprawny EMAIL.");
  process.exit(1);
}
if (password.length < 8) {
  console.error("PASSWORD musi mieć min 8 znaków.");
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

async function main() {
  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, email: true, deletedAt: true },
  });
  if (!user) {
    console.error(`User ${email} nie istnieje.`);
    process.exit(2);
  }
  if (user.deletedAt) {
    console.error(`User ${email} jest soft-deleted — przywróć w panelu adm. przed resetem.`);
    process.exit(3);
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  await db.user.update({ where: { id: user.id }, data: { passwordHash } });
  console.log(`✅ Hasło zresetowane dla ${user.email} (id=${user.id}).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
