-- F12-K141: projekty w module subskrypcji + dostępy userów per projekt.

CREATE TABLE "SubscriptionProject" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "SubscriptionProject_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SubscriptionProject_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "SubscriptionProject_workspaceId_deletedAt_idx" ON "SubscriptionProject"("workspaceId", "deletedAt");

CREATE TABLE "SubscriptionProjectMember" (
  "projectId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  CONSTRAINT "SubscriptionProjectMember_pkey" PRIMARY KEY ("projectId", "userId"),
  CONSTRAINT "SubscriptionProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "SubscriptionProject"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SubscriptionProjectMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "SubscriptionProjectMember_userId_idx" ON "SubscriptionProjectMember"("userId");

ALTER TABLE "Subscription" ADD COLUMN "projectId" TEXT;
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "SubscriptionProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
