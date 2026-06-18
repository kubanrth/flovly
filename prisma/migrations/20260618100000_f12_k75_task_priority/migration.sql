-- F12-K75: Task priority field (Linear-style).

CREATE TYPE "TaskPriority" AS ENUM ('NONE', 'LOW', 'MEDIUM', 'HIGH', 'URGENT');

ALTER TABLE "Task" ADD COLUMN "priority" "TaskPriority" NOT NULL DEFAULT 'NONE';

CREATE INDEX "Task_boardId_priority_idx" ON "Task"("boardId", "priority");
