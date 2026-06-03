-- F12-K63: cross-task references. Single directed row per pair (source →
-- target) but the detail page renders the link from both endpoints, so the
-- relationship reads as symmetric in the UI.

CREATE TABLE "TaskLink" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "sourceTaskId" TEXT NOT NULL,
    "targetTaskId" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TaskLink_sourceTaskId_targetTaskId_key"
    ON "TaskLink"("sourceTaskId", "targetTaskId");
CREATE INDEX "TaskLink_targetTaskId_idx" ON "TaskLink"("targetTaskId");
CREATE INDEX "TaskLink_workspaceId_idx" ON "TaskLink"("workspaceId");

ALTER TABLE "TaskLink"
    ADD CONSTRAINT "TaskLink_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskLink"
    ADD CONSTRAINT "TaskLink_sourceTaskId_fkey"
    FOREIGN KEY ("sourceTaskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskLink"
    ADD CONSTRAINT "TaskLink_targetTaskId_fkey"
    FOREIGN KEY ("targetTaskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
