-- F14: dostęp per obiekt (hasła, kontakty, whiteboardy, subskrypcje, zadania, widoki tablic).
CREATE TYPE "ResourceKind" AS ENUM ('SECRET', 'CONTACT', 'CANVAS', 'SUBSCRIPTION', 'TASK', 'BOARD_VIEW');

CREATE TABLE "ResourceAccess" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "kind" "ResourceKind" NOT NULL,
    "resourceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ResourceAccess_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ResourceAccess_kind_resourceId_userId_key" ON "ResourceAccess"("kind", "resourceId", "userId");
CREATE INDEX "ResourceAccess_workspaceId_kind_userId_idx" ON "ResourceAccess"("workspaceId", "kind", "userId");
CREATE INDEX "ResourceAccess_kind_resourceId_idx" ON "ResourceAccess"("kind", "resourceId");
ALTER TABLE "ResourceAccess" ADD CONSTRAINT "ResourceAccess_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResourceAccess" ADD CONSTRAINT "ResourceAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
