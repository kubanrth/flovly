-- F12-K131: many-to-many task↔view assignment.
-- Named views (BoardView z name != NULL) pokazują TYLKO task'i przypisane
-- explicit. Default views (name = NULL) pokazują wszystkie tasks boardu.

CREATE TABLE "TaskView" (
  "taskId" TEXT NOT NULL,
  "viewId" TEXT NOT NULL,
  CONSTRAINT "TaskView_pkey" PRIMARY KEY ("taskId", "viewId"),
  CONSTRAINT "TaskView_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TaskView_viewId_fkey" FOREIGN KEY ("viewId") REFERENCES "BoardView"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "TaskView_viewId_idx" ON "TaskView"("viewId");
