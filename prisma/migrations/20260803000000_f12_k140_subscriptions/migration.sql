-- F12-K140: moduł zarządzania subskrypcjami firmy.

CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'YEARLY');

CREATE TABLE "Subscription" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "url" TEXT,
  "amountCents" INTEGER NOT NULL DEFAULT 0,
  "cycle" "BillingCycle" NOT NULL DEFAULT 'MONTHLY',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Subscription_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "Subscription_workspaceId_deletedAt_idx" ON "Subscription"("workspaceId", "deletedAt");
