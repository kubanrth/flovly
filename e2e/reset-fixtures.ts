// Run by e2e/auth.setup.ts through `npx tsx` (Playwright doesn't resolve the
// `@/` alias that lib/db.ts needs). Makes the seed data deterministic so specs
// stay order- and time-independent:
//   1. clears persisted view config (filters/groupBy/widths) on the seed board,
//   2. parks 4 admin-assigned tasks in the my-tasks buckets (overdue / today /
//      upcoming / no due date), all in a non-done status column,
//   3. enables every board view on the demo workspace,
//   4. soft-deletes boards and tasks left behind by earlier runs.
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
  // Boards the specs create pile up across runs: they slow every page that
  // lists boards and make `gotoFirstBoard` pick an arbitrary one. Soft-delete
  // last run's leftovers before this run starts.
  const junk = await db.board.updateMany({
    where: {
      workspace: { slug: "demo" },
      deletedAt: null,
      // Only the prefixes the specs and critics generate. Nothing broader —
      // "AK…" also matches the seeded AK59 board the my-tasks fixture parks on.
      OR: [{ name: { startsWith: "e2e-board-" } }, { name: { startsWith: "KRYTYK-" } }],
    },
    data: { deletedAt: new Date() },
  });

  // Tasks the specs create also pile up: the seed board went from 6 to 142
  // rows across runs, which pushed the Lista past the 5 s expect timeout and
  // made unrelated specs fail. Only creation-shaped names are pruned — specs
  // that RENAME a seed task (AK45/AK66) must keep their row.
  const stale = await db.task.updateMany({
    where: {
      board: { workspace: { slug: "demo" } },
      deletedAt: null,
      OR: [
        { title: { startsWith: "e2e-" } },
        { title: { startsWith: "kanban-" } },
        { title: { startsWith: "probe-" } },
        { title: { startsWith: "konflikt-" } },
        { title: { startsWith: "autosave-" } },
        { title: "AK54" },
      ],
    },
    data: { deletedAt: new Date() },
  });

  // Seed data predates CALENDAR and TASKLINE, so those tabs never rendered.
  await db.workspace.updateMany({
    where: { slug: "demo" },
    data: { enabledViews: ["TABLE", "KANBAN", "ROADMAP", "GANTT", "CALENDAR", "WHITEBOARD", "TASKLINE"] },
  });

  console.log(`reset ${reset.count} view(s); ${junk.count} stale board(s); ${stale.count} stale task(s); ${tasks.length} my-tasks buckets on board ${board.id}`);
  await db.$disconnect();
})();
