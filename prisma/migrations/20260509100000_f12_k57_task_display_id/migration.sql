-- F12-K57: ludzki ID zadania per-workspace (1, 2, 3...) wyświetlany
-- zamiast obciętego cuid'a.

ALTER TABLE "Task" ADD COLUMN "displayId" INTEGER NOT NULL DEFAULT 0;

-- Backfill: assign 1..N per workspace, ordered by createdAt asc.
-- Window function row_number() — najprostsza droga.
UPDATE "Task"
SET "displayId" = sub.rn
FROM (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY "workspaceId"
    ORDER BY "createdAt" ASC
  ) AS rn
  FROM "Task"
) AS sub
WHERE "Task".id = sub.id;

-- Composite index dla szybkiego "next number" lookup'u przy createTaskAction.
CREATE INDEX "Task_workspaceId_displayId_idx" ON "Task"("workspaceId", "displayId");
