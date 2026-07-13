-- F12-K133: TimeCamp-like time tracking.
-- User dostaje domyślną stawkę godzinową; TimeEntry to historia wpisów.

ALTER TABLE "User" ADD COLUMN "hourlyRateCents" INTEGER;

CREATE TABLE "TimeEntry" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "taskId" TEXT,
  "userId" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL,
  "stoppedAt" TIMESTAMP(3) NOT NULL,
  "durationSeconds" INTEGER NOT NULL,
  "note" TEXT,
  "billable" BOOLEAN NOT NULL DEFAULT true,
  "rateSnapshotCents" INTEGER,
  "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "TimeEntry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TimeEntry_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TimeEntry_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "TimeEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON UPDATE CASCADE ON DELETE NO ACTION,
  CONSTRAINT "TimeEntry_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE INDEX "TimeEntry_workspaceId_startedAt_idx" ON "TimeEntry"("workspaceId", "startedAt");
CREATE INDEX "TimeEntry_userId_startedAt_idx" ON "TimeEntry"("userId", "startedAt");
CREATE INDEX "TimeEntry_taskId_idx" ON "TimeEntry"("taskId");
