-- F12-K60: sales pipeline. Workspace-scoped stages + deals. Default stages
-- are seeded lazily on first /sales access (no data backfill here).

CREATE TABLE "DealStage" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "colorHex" TEXT NOT NULL DEFAULT '#7B68EE',
    "order" INTEGER NOT NULL DEFAULT 0,
    "closedKind" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "DealStage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DealStage_workspaceId_order_idx" ON "DealStage"("workspaceId", "order");

ALTER TABLE "DealStage"
    ADD CONSTRAINT "DealStage_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Deal" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "ownerId" TEXT,
    "stageId" TEXT NOT NULL,
    "contactId" TEXT,
    "title" TEXT NOT NULL,
    "valueAmount" DOUBLE PRECISION,
    "valueCurrency" TEXT NOT NULL DEFAULT 'PLN',
    "expectedCloseAt" TIMESTAMP(3),
    "notesJson" JSONB,
    "rowOrder" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Deal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Deal_workspaceId_deletedAt_idx" ON "Deal"("workspaceId", "deletedAt");
CREATE INDEX "Deal_stageId_rowOrder_idx" ON "Deal"("stageId", "rowOrder");
CREATE INDEX "Deal_contactId_idx" ON "Deal"("contactId");

ALTER TABLE "Deal"
    ADD CONSTRAINT "Deal_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Deal"
    ADD CONSTRAINT "Deal_creatorId_fkey"
    FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON UPDATE CASCADE;
ALTER TABLE "Deal"
    ADD CONSTRAINT "Deal_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON UPDATE CASCADE;
ALTER TABLE "Deal"
    ADD CONSTRAINT "Deal_stageId_fkey"
    FOREIGN KEY ("stageId") REFERENCES "DealStage"("id") ON UPDATE CASCADE;
ALTER TABLE "Deal"
    ADD CONSTRAINT "Deal_contactId_fkey"
    FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
