-- F12-K132: team password vault (workspace-scoped).
-- Password + notatka szyfrowane AES-256-GCM z VAULT_KEY env var.

CREATE TABLE "SecretItem" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" TEXT,
  "url" TEXT,
  "username" TEXT,
  "passwordEnc" TEXT NOT NULL,
  "passwordIv" TEXT NOT NULL,
  "notesEnc" TEXT,
  "notesIv" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "SecretItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SecretItem_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SecretItem_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON UPDATE CASCADE ON DELETE NO ACTION
);

CREATE INDEX "SecretItem_workspaceId_deletedAt_idx" ON "SecretItem"("workspaceId", "deletedAt");
CREATE INDEX "SecretItem_ownerId_idx" ON "SecretItem"("ownerId");
