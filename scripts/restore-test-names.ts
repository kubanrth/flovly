// One-off cleanup: restore renamed test data back to canonical names.
// Run after rename smoke tests: npx tsx scripts/restore-test-names.ts
import "dotenv/config";
import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

async function main() {
  const w = await db.workspace.updateMany({
    where: { slug: "puppeteer-sst" },
    data: { name: "SideSideTwo" },
  });
  const w2 = await db.workspace.updateMany({
    where: { slug: "puppeteer-asd" },
    data: { name: "asdfdasf" },
  });
  const b = await db.board.updateMany({
    where: { name: "Test Board RENAMED" },
    data: { name: "Test Board" },
  });
  console.log({ workspaceSst: w.count, workspaceAsd: w2.count, boards: b.count });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
}).finally(() => db.$disconnect());
