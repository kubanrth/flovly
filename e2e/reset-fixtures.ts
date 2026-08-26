// Run by e2e/auth.setup.ts through `npx tsx` (Playwright doesn't resolve the
// `@/` alias that lib/db.ts needs). Makes the seed data deterministic so specs
// stay order- and time-independent:
//   1. clears persisted view config (filters/groupBy/widths) on the seed board,
//   2. parks 4 admin-assigned tasks in the my-tasks buckets (overdue / today /
//      upcoming / no due date), all in a non-done status column.
// A bare tsx subprocess doesn't get Next.js's .env loading.
import "dotenv/config";
import { db } from "@/lib/db";

const DAY = 86_400_000;

void (async () => {
  const boards = await db.board.findMany({
    where: { workspace: { slug: "demo" } },
    select: {
      id: true,
      statusColumns: { select: { id: true, order: true }, orderBy: { order: "asc" } },
      _count: { select: { tasks: { where: { deletedAt: null } } } },
    },
  });
  const reset = await db.boardView.updateMany({
    where: { boardId: { in: boards.map((b) => b.id) }, type: "TABLE" },
    data: { configJson: {} },
  });

  const admin = await db.user.findUnique({ where: { email: "admin@danielos.local" }, select: { id: true } });
  // The seed board (most tasks) — e2e also creates empty boards.
  const board = boards
    .filter((b) => b.statusColumns.length > 1)
    .sort((a, b) => b._count.tasks - a._count.tasks)[0];
  if (!admin || !board) {
    console.log(`reset ${reset.count} view(s); no board with status columns — skipped my-tasks fixture`);
    await db.$disconnect();
    return;
  }
  // K91 treats the LAST status column as "done", so park fixtures in the first.
  const open = board.statusColumns[0]!.id;
  const now = Date.now();
  const stops: (Date | null)[] = [
    new Date(now - 2 * DAY), // Zaległe
    new Date(now + 60_000), // Na dziś (never goes stale mid-run)
    new Date(now + 5 * DAY), // Nadchodzące
    null, // Bez terminu
  ];
  // Reuse existing tasks instead of creating fixtures — keeps the board clean
  // and avoids displayId bookkeeping.
  const tasks = await db.task.findMany({
    where: { boardId: board.id, deletedAt: null },
    orderBy: { rowOrder: "asc" },
    take: stops.length,
    select: { id: true },
  });
  for (const [i, t] of tasks.entries()) {
    await db.task.update({ where: { id: t.id }, data: { stopAt: stops[i]!, statusColumnId: open } });
    await db.taskAssignee.upsert({
      where: { taskId_userId: { taskId: t.id, userId: admin.id } },
      update: {},
      create: { taskId: t.id, userId: admin.id },
    });
  }
  console.log(`reset ${reset.count} view(s); ${tasks.length} my-tasks buckets on board ${board.id}`);
  await db.$disconnect();
})();
