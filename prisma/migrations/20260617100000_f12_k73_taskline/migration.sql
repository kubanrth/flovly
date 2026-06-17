-- F12-K73: Task Line — nowy widok wizualizacji workflow'u zadań.
-- ProcessCanvas dostaje pole kind żeby per board mogły być 2 canvasy:
-- whiteboard + taskline. NodeShape dostaje TASK_REF do referencji do
-- Task'a. ViewType dostaje TASKLINE do registry widoków.

ALTER TYPE "ViewType" ADD VALUE 'TASKLINE';
ALTER TYPE "NodeShape" ADD VALUE 'TASK_REF';

ALTER TABLE "ProcessCanvas" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'whiteboard';

-- Relax unique (boardId) → unique (boardId, kind). Każda tablica może mieć
-- po jednym canvasie każdego rodzaju. Istniejące rekordy mają kind = default
-- 'whiteboard'.
DROP INDEX IF EXISTS "ProcessCanvas_boardId_key";
CREATE UNIQUE INDEX "ProcessCanvas_boardId_kind_key"
    ON "ProcessCanvas"("boardId", "kind");
