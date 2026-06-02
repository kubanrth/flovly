-- F12-K61: timeline aktywności per deal. Notatki użytkowników (type="note")
-- + auto-eventy (stage_change / value_change / itp.) lądują w tej samej
-- tabeli z `type` jako discriminator. Body JSON trzyma Tiptap dla notatek
-- albo before/after payload dla eventów.

CREATE TABLE "DealActivity" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "actorId" TEXT,
    "type" TEXT NOT NULL,
    "bodyJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DealActivity_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DealActivity_dealId_createdAt_idx" ON "DealActivity"("dealId", "createdAt" DESC);
CREATE INDEX "DealActivity_workspaceId_idx" ON "DealActivity"("workspaceId");

ALTER TABLE "DealActivity"
    ADD CONSTRAINT "DealActivity_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DealActivity"
    ADD CONSTRAINT "DealActivity_dealId_fkey"
    FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DealActivity"
    ADD CONSTRAINT "DealActivity_actorId_fkey"
    FOREIGN KEY ("actorId") REFERENCES "User"("id") ON UPDATE CASCADE;
