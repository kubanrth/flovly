-- F13: „Zapotrzebowanie" — zgłoszenia rzeczy do kupienia.

CREATE TABLE "PurchaseRequest" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "requesterId" TEXT NOT NULL,
  "project" TEXT NOT NULL,
  "link" TEXT,
  "costCents" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "PurchaseRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PurchaseRequest_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PurchaseRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "PurchaseRequest_workspaceId_deletedAt_idx" ON "PurchaseRequest"("workspaceId", "deletedAt");
