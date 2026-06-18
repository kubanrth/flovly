-- F12-K79: Public share links dla tablic.

CREATE TABLE "BoardShareLink" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "name" TEXT,
    "createdById" TEXT NOT NULL,
    "lastAccessedAt" TIMESTAMP(3),
    "accessCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BoardShareLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BoardShareLink_token_key" ON "BoardShareLink"("token");
CREATE INDEX "BoardShareLink_boardId_idx" ON "BoardShareLink"("boardId");
CREATE INDEX "BoardShareLink_workspaceId_idx" ON "BoardShareLink"("workspaceId");

ALTER TABLE "BoardShareLink" ADD CONSTRAINT "BoardShareLink_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BoardShareLink" ADD CONSTRAINT "BoardShareLink_boardId_fkey"
    FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BoardShareLink" ADD CONSTRAINT "BoardShareLink_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
