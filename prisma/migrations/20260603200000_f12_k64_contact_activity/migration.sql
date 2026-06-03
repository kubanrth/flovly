-- F12-K64: timeline aktywności w karcie kontaktu. Notatki użytkownika
-- (type="note", Tiptap doc w bodyJson) + auto-eventy z edycji kontaktu
-- (created, field_change, owner_change). Mirror DealActivity.

CREATE TABLE "ContactActivity" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "actorId" TEXT,
    "type" TEXT NOT NULL,
    "bodyJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactActivity_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ContactActivity_contactId_createdAt_idx"
    ON "ContactActivity"("contactId", "createdAt" DESC);
CREATE INDEX "ContactActivity_workspaceId_idx" ON "ContactActivity"("workspaceId");

ALTER TABLE "ContactActivity"
    ADD CONSTRAINT "ContactActivity_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContactActivity"
    ADD CONSTRAINT "ContactActivity_contactId_fkey"
    FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContactActivity"
    ADD CONSTRAINT "ContactActivity_actorId_fkey"
    FOREIGN KEY ("actorId") REFERENCES "User"("id") ON UPDATE CASCADE;
