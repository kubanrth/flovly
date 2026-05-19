// F12-K62: smoke verify — sprawdza ile task.created / task.status.changed
// notyfikacji ma Anna (recipient). Uruchom po utworzeniu task'a w puppeteer'ze.
import "dotenv/config";
import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

async function main() {
  const recipient = await db.user.findUnique({
    where: { email: "puppeteer-recipient@flovly.local" },
  });
  if (!recipient) {
    console.log("no recipient user");
    return;
  }
  const notifs = await db.notification.findMany({
    where: {
      userId: recipient.id,
      type: { in: ["task.created", "task.status.changed"] },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  console.log("Anna notifications:", notifs.length);
  for (const n of notifs) {
    const p = n.payload as { taskTitle?: string; fromStatusName?: string; toStatusName?: string };
    console.log(
      ` - ${n.type} | "${p.taskTitle}" | ${
        n.type === "task.status.changed"
          ? `${p.fromStatusName ?? "—"} → ${p.toStatusName ?? "—"}`
          : ""
      } | ${n.createdAt.toISOString()}`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
}).finally(() => db.$disconnect());
