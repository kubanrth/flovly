-- F12-K58: cross-board roadmap aggregation.
--
-- 1. Board.isAggregator flag — when true, the board's milestones can pull in
--    milestones from other boards in the same workspace.
-- 2. MilestoneLink M:N join — parent (on aggregator board) ↔ child (on a
--    sub-board). A single child can be referenced by multiple parents.

ALTER TABLE "Board" ADD COLUMN "isAggregator" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "MilestoneLink" (
    "id" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MilestoneLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MilestoneLink_parentId_childId_key" ON "MilestoneLink"("parentId", "childId");
CREATE INDEX "MilestoneLink_childId_idx" ON "MilestoneLink"("childId");

ALTER TABLE "MilestoneLink"
    ADD CONSTRAINT "MilestoneLink_parentId_fkey"
    FOREIGN KEY ("parentId") REFERENCES "Milestone"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MilestoneLink"
    ADD CONSTRAINT "MilestoneLink_childId_fkey"
    FOREIGN KEY ("childId") REFERENCES "Milestone"("id") ON DELETE CASCADE ON UPDATE CASCADE;
