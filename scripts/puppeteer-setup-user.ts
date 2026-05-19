// F12-K59: one-off — tworzy / aktualizuje tymczasowego usera + 2
// workspace'y do screenshotów sidebar redesign w puppeteer'ze.
// Po zrobieniu screenshotów wywołaj scripts/puppeteer-teardown-user.ts.
//
// Run: npx tsx scripts/puppeteer-setup-user.ts
//
// Test creds:
//   email: puppeteer-test@flovly.local
//   password: temp-puppeteer-2026

import "dotenv/config";
import { PrismaClient } from "../lib/generated/prisma/client";
import { Role, ViewType } from "../lib/generated/prisma/enums";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcrypt";

const TEST_EMAIL = "puppeteer-test@flovly.local";
const TEST_PASSWORD = "temp-puppeteer-2026";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

async function main() {
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 12);

  const user = await db.user.upsert({
    where: { email: TEST_EMAIL },
    update: { passwordHash, name: "Kuba", emailVerified: new Date(), isSuperAdmin: true },
    create: {
      email: TEST_EMAIL,
      name: "Kuba",
      passwordHash,
      isSuperAdmin: true,
      emailVerified: new Date(),
    },
  });
  console.log("user:", user.email, user.id);

  // F12-K62: drugi user żeby test'ować notyfikacje task lifecycle. Kuba
  // jest creatorem/actorem; "Anna" dostaje powiadomienia bo jest member.
  const recipient = await db.user.upsert({
    where: { email: "puppeteer-recipient@flovly.local" },
    update: { passwordHash, name: "Anna", emailVerified: new Date() },
    create: {
      email: "puppeteer-recipient@flovly.local",
      name: "Anna",
      passwordHash,
      isSuperAdmin: false,
      emailVerified: new Date(),
    },
  });
  console.log("recipient:", recipient.email, recipient.id);

  // 2 workspace'y + board z view'ami żeby było widać sidebar swatches
  // + view switcher na board page.
  const boardSlugs: string[] = [];
  for (const [slug, name, withBoard] of [
    ["puppeteer-sst", "SideSideTwo", true],
    ["puppeteer-asd", "asdfdasf", false],
  ] as const) {
    const ws = await db.workspace.upsert({
      where: { slug },
      update: { ownerId: user.id, deletedAt: null },
      create: { name, slug, ownerId: user.id },
    });
    await db.workspaceMembership.upsert({
      where: { workspaceId_userId: { workspaceId: ws.id, userId: user.id } },
      update: { role: Role.ADMIN },
      create: { workspaceId: ws.id, userId: user.id, role: Role.ADMIN },
    });
    // F12-K62: recipient też membership żeby dostawał notyfikacje.
    await db.workspaceMembership.upsert({
      where: { workspaceId_userId: { workspaceId: ws.id, userId: recipient.id } },
      update: { role: Role.MEMBER },
      create: { workspaceId: ws.id, userId: recipient.id, role: Role.MEMBER },
    });
    console.log("workspace:", slug, ws.id);

    if (withBoard) {
      // F12-K60: board z table+kanban+roadmap views żeby test'ować
      // liquid-glass view switcher.
      const existingBoard = await db.board.findFirst({
        where: { workspaceId: ws.id, name: "Test Board" },
      });
      const board = existingBoard
        ? existingBoard
        : await db.board.create({
            data: {
              workspaceId: ws.id,
              creatorId: user.id,
              name: "Test Board",
              statusColumns: {
                create: [
                  { name: "Do zrobienia", colorHex: "#64748B", order: 0 },
                  { name: "W trakcie", colorHex: "#F59E0B", order: 1 },
                  { name: "Done", colorHex: "#10B981", order: 2 },
                ],
              },
              views: {
                create: [
                  { type: ViewType.TABLE, configJson: {}, background: { kind: "color", value: "#F8FAFC" } },
                  { type: ViewType.KANBAN, configJson: {}, background: { kind: "color", value: "#F8FAFC" } },
                  { type: ViewType.ROADMAP, configJson: {}, background: { kind: "color", value: "#F8FAFC" } },
                ],
              },
            },
          });
      boardSlugs.push(`/w/${ws.id}/b/${board.id}/table`);
      console.log("board:", board.id);

      // F12-K60: pojedynczy task przypisany do test usera + status
      // w celu sprawdzenia inline status picker'a w /my-tasks.
      const cols = await db.statusColumn.findMany({
        where: { boardId: board.id },
        orderBy: { order: "asc" },
      });
      if (cols.length > 0) {
        const existingTask = await db.task.findFirst({
          where: { boardId: board.id, title: "Test task" },
        });
        const task = existingTask
          ? existingTask
          : await db.task.create({
              data: {
                workspaceId: ws.id,
                boardId: board.id,
                creatorId: user.id,
                title: "Test task",
                statusColumnId: cols[0].id,
                rowOrder: 1000,
              },
            });
        await db.taskAssignee.upsert({
          where: { taskId_userId: { taskId: task.id, userId: user.id } },
          update: {},
          create: { taskId: task.id, userId: user.id },
        });
        console.log("task:", task.id, "(assigned)");
      }
    }
  }

  console.log("\nBoards to view:");
  for (const path of boardSlugs) console.log("  http://localhost:3100" + path);
  console.log("\nDone. Login with:");
  console.log("  email:", TEST_EMAIL);
  console.log("  pw:   ", TEST_PASSWORD);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
}).finally(() => db.$disconnect());
