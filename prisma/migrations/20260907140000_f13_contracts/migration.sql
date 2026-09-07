-- F13: „Umowy" — wpis umowy z polami definiowanymi przez użytkownika (JSON).

CREATE TABLE "Contract" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "creatorId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "details" JSONB NOT NULL DEFAULT '[]',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "Contract_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Contract_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Contract_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "Contract_workspaceId_deletedAt_idx" ON "Contract"("workspaceId", "deletedAt");
